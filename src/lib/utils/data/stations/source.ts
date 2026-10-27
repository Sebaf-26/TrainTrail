import { sql } from 'kysely';
import { z } from 'zod';

import { COUNTRIES } from '$lib/data/countries';
import { db } from '$lib/db';
import type { Station } from '$lib/db/types';
import { forEachDelimitedRow } from '$lib/utils/delimited-stream';
import { deepEqual } from '$lib/utils/other';

export const BATCH_SIZE = 1000;
const STATION_SOURCE_URL =
  'https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv';

const CONTINENT_BY_REGION = {
  Europe: 'EU',
  Asia: 'AS',
  Africa: 'AF',
  Oceania: 'OC',
} as const;
const SOUTH_AMERICA = new Set([
  'AR',
  'BO',
  'BR',
  'CL',
  'CO',
  'EC',
  'FK',
  'GF',
  'GY',
  'PE',
  'PY',
  'SR',
  'UY',
  'VE',
]);
const regionByCountry = new Map(COUNTRIES.map((c) => [c.alpha2, c.continent]));

const stationSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  uic: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  parent_station_id: z.string(),
  country: z.string().regex(/^[A-Z]{2}$/),
  time_zone: z.string().min(1),
  is_city: z.string(),
  is_main_station: z.string(),
  same_as: z.string(),
  trenitalia_id: z.string(),
  trenitalia_rtvt_id: z.string(),
  trenord_id: z.string(),
  ntv_id: z.string(),
  ntv_rtiv_id: z.string(),
});

type StationSourceRow = z.infer<typeof stationSourceSchema>;

type InsertStation = Omit<Station, 'id'>;

const ITALIAN_RAIL_ID_FIELDS = [
  'trenitalia_id',
  'trenitalia_rtvt_id',
  'trenord_id',
  'ntv_id',
  'ntv_rtiv_id',
] as const;

export const ensureStations = async () => {
  const stations = await db
    .selectFrom('station')
    .select('id')
    .where('custom', '=', false)
    .limit(1)
    .executeTakeFirst();

  if (stations) {
    return;
  }

  console.log('Populating initial station database...');
  console.time('Populate initial station database');

  try {
    // Check for existing (custom) stations to avoid duplicates
    const existingStations = await db
      .selectFrom('station')
      .select('code')
      .execute();
    const existingCodes = new Set(existingStations.map((s) => s.code));
    const batch: InsertStation[] = [];

    await forEachFetchedStation(async (station) => {
      if (existingCodes.has(station.code)) {
        return;
      }

      batch.push(station);
      if (batch.length >= BATCH_SIZE) {
        await insertStationBatch(batch);
      }
    });

    await insertStationBatch(batch);
  } catch (err) {
    console.error(
      'Could not download the station list. Retry from Settings -> Data -> Stations -> Sync.',
      err,
    );
  }

  console.timeEnd('Populate initial station database');
};

export const updateStations = async () => {
  const start = Date.now();

  const existingStations = await db.selectFrom('station').selectAll().execute();
  const existingMap = new Map(existingStations.map((s) => [s.code, s]));
  const seenCodes = new Set<string>();
  const newStations: InsertStation[] = [];
  const updatedStations: Station[] = [];
  let created = 0;
  let updated = 0;

  await forEachFetchedStation(async (station) => {
    seenCodes.add(station.code);

    const existing = existingMap.get(station.code);

    // Means the station was manually added by the user
    if (existing?.custom) {
      return;
    }

    if (!existing) {
      newStations.push(station);
      created += 1;
      if (newStations.length >= BATCH_SIZE) {
        await insertStationBatch(newStations);
      }
      return;
    }

    const { id: _, ...stationWithoutId } = existing;
    if (!deepEqual(station, stationWithoutId)) {
      updatedStations.push({ ...station, id: existing.id });
      updated += 1;
      if (updatedStations.length >= BATCH_SIZE) {
        await updateStationBatch(updatedStations);
      }
    }
  });

  await insertStationBatch(newStations);
  await updateStationBatch(updatedStations);

  const removedStations = existingStations.filter(
    (station) => !station.custom && !seenCodes.has(station.code),
  );

  // Don't delete stations that are referenced by journeys (ON DELETE SET NULL
  // would silently orphan the journey's station association).
  const removedIds = removedStations.map((s) => s.id);
  const referencedIds =
    removedStations.length > 0
      ? new Set(
          (
            await db
              .selectFrom('journey')
              .select('fromId')
              .where('fromId', 'in', removedIds)
              .union(
                db
                  .selectFrom('journey')
                  .select('toId as fromId')
                  .where('toId', 'in', removedIds),
              )
              .execute()
          ).map((r) => r.fromId),
        )
      : new Set<number | null>();

  const safeToRemove = removedStations.filter((s) => !referencedIds.has(s.id));

  for (let i = 0; i < safeToRemove.length; i += BATCH_SIZE) {
    await db
      .deleteFrom('station')
      .where(
        'id',
        'in',
        safeToRemove.slice(i, i + BATCH_SIZE).map((s) => s.id),
      )
      .execute();
  }

  return {
    created,
    updated,
    removed: safeToRemove.length,
    retained: removedStations.length - safeToRemove.length,
    time: Date.now() - start,
  };
};

export const fetchStations = async (): Promise<InsertStation[]> => {
  const stations: InsertStation[] = [];

  await forEachFetchedStation((station) => {
    stations.push(station);
  });

  return stations;
};

const forEachFetchedStation = async (
  onStation: (station: InsertStation) => Promise<void> | void,
) => {
  const resp = await fetch(STATION_SOURCE_URL);
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch station source CSV: ${resp.status} ${resp.statusText}`,
    );
  }
  if (!resp.body) {
    throw new Error('Station source CSV response did not include a body');
  }

  // A station's municipality is the name of its parent city node, which can
  // appear anywhere in the file, so the rows are collected before converting.
  const cityNames = new Map<string, string>();
  const candidates: StationSourceRow[] = [];
  let invalidRows = 0;

  await forEachDelimitedRow(resp.body, ';', (raw) => {
    const parsed = stationSourceSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRows += 1;
      return;
    }

    const row = parsed.data;
    if (row.is_city === 't') {
      cityNames.set(row.id, row.name);
      return;
    }
    if (row.same_as === '' && isRailStation(row)) {
      candidates.push(row);
    }
  });

  if (invalidRows > 0) {
    console.warn(`Skipped ${invalidRows} invalid rows in the station source`);
  }

  for (const row of candidates) {
    const station = toInsertStation(row, cityNames);
    if (station) {
      await onStation(station);
    }
  }
};

/**
 * The source also lists bus and tram stops. A UIC code is only assigned to
 * railway locations, and the Italian operator ids cover the stations that
 * have none, so those two (plus main stations) keep the list to railways.
 */
const isRailStation = (row: StationSourceRow) =>
  row.uic !== '' ||
  row.is_main_station === 't' ||
  ITALIAN_RAIL_ID_FIELDS.some((field) => row[field] !== '');

const toInsertStation = (
  row: StationSourceRow,
  cityNames: Map<string, string>,
): InsertStation | null => {
  const lat = parseCoordinate(row.latitude, 90);
  const lon = parseCoordinate(row.longitude, 180);
  if (lat === null || lon === null) {
    return null;
  }

  return {
    code: row.id,
    uic: row.uic || null,
    viaggiatrenoId: row.trenitalia_rtvt_id || null,
    name: row.name,
    municipality: cityNames.get(row.parent_station_id) ?? null,
    lat,
    lon,
    tz: row.time_zone,
    type: row.is_main_station === 't' ? 'main' : 'station',
    continent: getContinent(row.country),
    country: row.country,
    custom: false,
  };
};

const parseCoordinate = (value: string, limit: number) => {
  if (value === '') {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit
    ? coordinate
    : null;
};

const getContinent = (country: string): Station['continent'] => {
  const region = regionByCountry.get(country);
  if (region === 'Americas') {
    return SOUTH_AMERICA.has(country) ? 'SA' : 'NA';
  }

  return region && region in CONTINENT_BY_REGION
    ? CONTINENT_BY_REGION[region as keyof typeof CONTINENT_BY_REGION]
    : 'EU';
};

const insertStationBatch = async (stations: InsertStation[]) => {
  if (stations.length === 0) {
    return;
  }

  await db.insertInto('station').values(stations).execute();
  stations.length = 0;
};

const updateStationBatch = async (stations: Station[]) => {
  if (stations.length === 0) {
    return;
  }

  await sql`
    UPDATE station SET
      code = v.code,
      uic = v.uic,
      viaggiatreno_id = v.viaggiatreno_id,
      lat = v.lat,
      lon = v.lon,
      tz = v.tz,
      name = v.name,
      municipality = v.municipality,
      type = v.type,
      continent = v.continent,
      country = v.country,
      custom = v.custom
    FROM (VALUES ${sql.join(
      stations.map(
        (s) =>
          sql`(${s.id}::int, ${s.code}, ${s.uic}, ${s.viaggiatrenoId}, ${s.lat}::float8, ${s.lon}::float8, ${s.tz}, ${s.name}, ${s.municipality}, ${s.type}, ${s.continent}, ${s.country}, ${s.custom}::bool)`,
      ),
    )}) AS v(id, code, uic, viaggiatreno_id, lat, lon, tz, name, municipality, type, continent, country, custom)
    WHERE station.id = v.id
  `.execute(db);

  stations.length = 0;
};
