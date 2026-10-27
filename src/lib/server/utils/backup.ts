import { db } from '$lib/db';
import type { Journey } from '$lib/db/types';
import {
  journeyTrackPayloadSchema,
  type JourneyTrackInput,
} from '$lib/track/schema';
import { omit } from '$lib/utils/other';
import { listJourneysInScope } from '$lib/server/utils/journey';
import type { ResolvedJourneyScope } from '$lib/journey-scope';

type CfValueRow = {
  entityId: string;
  key: string;
  fieldType: string;
  value: unknown;
};

export type BackupFormat = 'json' | 'yaml';

export const referencedBackupUserIds = (
  journeys: readonly {
    passengers: readonly { userId: string | null }[];
  }[],
) => [
  ...new Set(
    journeys.flatMap((journey) =>
      journey.passengers.flatMap((passenger) =>
        passenger.userId ? [passenger.userId] : [],
      ),
    ),
  ),
];

const collectEntityIds = (rows: CfValueRow[]) => {
  const ids = {
    station: new Set<number>(),
    operator: new Set<number>(),
    train: new Set<number>(),
  };
  for (const row of rows) {
    if (typeof row.value !== 'number') continue;
    if (row.fieldType === 'station') ids.station.add(row.value);
    else if (row.fieldType === 'operator') ids.operator.add(row.value);
    else if (row.fieldType === 'train') ids.train.add(row.value);
  }
  return ids;
};

const buildCfByJourney = (
  rows: CfValueRow[],
  entityLookup: Record<string, Map<number, object>>,
) => {
  const cfByJourney = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    let map = cfByJourney.get(row.entityId);
    if (!map) {
      map = Object.create(null) as Record<string, unknown>;
      cfByJourney.set(row.entityId, map);
    }
    const lookup = entityLookup[row.fieldType];
    if (typeof row.value === 'number' && lookup) {
      map[row.key] = lookup.get(row.value) ?? row.value;
    } else {
      map[row.key] = row.value;
    }
  }
  return cfByJourney;
};

export const generateBackup = async (scope: ResolvedJourneyScope) => {
  const res = await listJourneysInScope(scope);
  const userIds = referencedBackupUserIds(res);
  const users =
    userIds.length === 0
      ? []
      : await db
          .selectFrom('user')
          .select(['id', 'displayName', 'username'])
          .where('id', 'in', userIds)
          .execute();
  const journeyIds = res.map((f) => f.id);
  const passengerIds = res.flatMap((journey) =>
    journey.passengers.map((passenger) => passenger.id),
  );
  const trackRows =
    journeyIds.length > 0
      ? await db
          .selectFrom('journeyTrack')
          .select(['journeyId', 'track', 'sourceFormat', 'sourceName'])
          .where('journeyId', 'in', journeyIds)
          .execute()
      : [];
  const tracksByJourney = new Map<number, JourneyTrackInput>(
    trackRows.map((row) => {
      const track = journeyTrackPayloadSchema.parse(row.track);
      return [
        row.journeyId,
        {
          ...track,
          sourceFormat: row.sourceFormat,
          sourceName: row.sourceName,
        },
      ];
    }),
  );

  const getCustomFieldValues = async (
    entityType: 'journey' | 'journey_passenger',
    entityIds: number[],
  ): Promise<CfValueRow[]> =>
    entityIds.length > 0
      ? await db
          .selectFrom('customFieldValue as v')
          .innerJoin('customFieldDefinition as d', 'd.id', 'v.fieldId')
          .select(['v.entityId', 'd.key', 'd.fieldType', 'v.value'])
          .where('v.entityType', '=', entityType)
          .where('v.entityId', 'in', entityIds.map(String))
          .execute()
      : [];

  const [journeyCfValueRows, passengerCfValueRows] = await Promise.all([
    getCustomFieldValues('journey', journeyIds),
    getCustomFieldValues('journey_passenger', passengerIds),
  ]);

  const entityIds = collectEntityIds([
    ...journeyCfValueRows,
    ...passengerCfValueRows,
  ]);

  const fetchEntity = (
    table: 'station' | 'operator' | 'train',
    ids: Set<number>,
  ) =>
    ids.size > 0
      ? db
          .selectFrom(table)
          .selectAll()
          .where('id', 'in', [...ids])
          .execute()
      : Promise.resolve([]);

  const [cfStations, cfOperators, cfTrains] = await Promise.all([
    fetchEntity('station', entityIds.station),
    fetchEntity('operator', entityIds.operator),
    fetchEntity('train', entityIds.train),
  ]);
  const entityLookup = {
    station: new Map(cfStations.map((a) => [a.id, omit(a, ['id'])])),
    operator: new Map(cfOperators.map((a) => [a.id, omit(a, ['id'])])),
    train: new Map(cfTrains.map((a) => [a.id, omit(a, ['id'])])),
  } as Record<string, Map<number, object>>;

  const cfByJourney = buildCfByJourney(journeyCfValueRows, entityLookup);
  const cfByPassenger = buildCfByJourney(passengerCfValueRows, entityLookup);

  const journeys = res.map((journey: Journey) => ({
    ...omit(journey, ['id']),
    from: journey.from ? omit(journey.from, ['id']) : null,
    to: journey.to ? omit(journey.to, ['id']) : null,
    operator: journey.operator ? omit(journey.operator, ['id']) : null,
    train: journey.train ? omit(journey.train, ['id']) : null,
    passengers: journey.passengers.map((passenger) => ({
      ...omit(passenger, ['id', 'journeyId']),
      ...(cfByPassenger.has(String(passenger.id))
        ? { customFields: cfByPassenger.get(String(passenger.id)) }
        : {}),
    })),
    ...(tracksByJourney.has(journey.id)
      ? { track: tracksByJourney.get(journey.id) }
      : {}),
    ...(cfByJourney.has(String(journey.id))
      ? { customFields: cfByJourney.get(String(journey.id)) }
      : {}),
  }));

  return { users, journeys };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const yamlKey = (key: string) =>
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);

const yamlScalar = (value: unknown) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(String(value));
};

const isScalar = (value: unknown) =>
  value === null ||
  value === undefined ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

export const stringifyYaml = (value: unknown, indent = 0): string => {
  const prefix = ' '.repeat(indent);

  if (isScalar(value)) {
    return `${prefix}${yamlScalar(value)}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix}[]`;
    return value
      .map((item) => {
        if (isScalar(item)) return `${prefix}- ${yamlScalar(item)}`;
        return `${prefix}-\n${stringifyYaml(item, indent + 2)}`;
      })
      .join('\n');
  }

  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${prefix}{}`;
    return entries
      .map(([key, item]) => {
        if (isScalar(item)) {
          return `${prefix}${yamlKey(key)}: ${yamlScalar(item)}`;
        }
        return `${prefix}${yamlKey(key)}:\n${stringifyYaml(item, indent + 2)}`;
      })
      .join('\n');
  }

  return `${prefix}${yamlScalar(value)}`;
};

export const serializeBackup = (backup: unknown, format: BackupFormat) => {
  if (format === 'yaml') {
    return `${stringifyYaml(backup)}\n`;
  }
  return `${JSON.stringify(backup, null, 2)}\n`;
};

/** `json` when absent; null for a format that is not supported. */
export const parseBackupFormat = (
  value: string | null,
): BackupFormat | null => {
  if (value === null || value === 'json') return 'json';
  if (value === 'yaml' || value === 'yml') return 'yaml';
  return null;
};

const BACKUP_CONTENT_TYPES: Record<BackupFormat, string> = {
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
};

export const backupDownload = (
  backup: unknown,
  format: BackupFormat,
  headers: Record<string, string> = {},
) =>
  new Response(serializeBackup(backup, format), {
    headers: {
      'Content-Disposition': `attachment; filename="traintrail.${format}"`,
      'Content-Type': BACKUP_CONTENT_TYPES[format],
      ...headers,
    },
  });
