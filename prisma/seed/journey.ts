import { format } from 'date-fns';
import { Sync as Factory } from 'factory.ts';
import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';
import type { CreateJourney } from '../../src/lib/db/types';

const routes = [
  { from: 'milano-centrale', to: 'roma-termini', duration: 10500 },
  { from: 'roma-termini', to: 'napoli-centrale', duration: 4200 },
  { from: 'torino-porta-nuova', to: 'milano-centrale', duration: 3600 },
  { from: 'milano-centrale', to: 'venezia-santa-lucia', duration: 9000 },
  {
    from: 'firenze-santa-maria-novella',
    to: 'bologna-centrale',
    duration: 2100,
  },
  { from: 'paris-gare-de-lyon', to: 'lyon-part-dieu', duration: 6900 },
  { from: 'zurich-hb', to: 'milano-centrale', duration: 12000 },
  { from: 'london-st-pancras', to: 'paris-gare-du-nord', duration: 8400 },
];

const seedStations = [
  {
    slug: 'milano-centrale',
    uic: '8301700',
    name: 'Milano Centrale',
    municipality: 'Milano',
    lat: 45.4871,
    lon: 9.20482,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'roma-termini',
    uic: '8308409',
    name: 'Roma Termini',
    municipality: 'Roma',
    lat: 41.9008,
    lon: 12.5019,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'napoli-centrale',
    uic: '8309218',
    name: 'Napoli Centrale',
    municipality: 'Napoli',
    lat: 40.8528,
    lon: 14.273,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'torino-porta-nuova',
    uic: '8300219',
    name: 'Torino Porta Nuova',
    municipality: 'Torino',
    lat: 45.061,
    lon: 7.67771,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'venezia-santa-lucia',
    uic: '8302593',
    name: 'Venezia Santa Lucia',
    municipality: 'Venezia',
    lat: 45.4413,
    lon: 12.3204,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'firenze-santa-maria-novella',
    uic: '8306421',
    name: 'Firenze Santa Maria Novella',
    municipality: 'Firenze',
    lat: 43.7768,
    lon: 11.2478,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'bologna-centrale',
    uic: '8305043',
    name: 'Bologna Centrale',
    municipality: 'Bologna',
    lat: 44.5061,
    lon: 11.3434,
    country: 'IT',
    tz: 'Europe/Rome',
  },
  {
    slug: 'paris-gare-de-lyon',
    uic: null,
    name: 'Paris Gare de Lyon',
    municipality: 'Paris',
    lat: 48.8443,
    lon: 2.3744,
    country: 'FR',
    tz: 'Europe/Paris',
  },
  {
    slug: 'lyon-part-dieu',
    uic: null,
    name: 'Lyon Part-Dieu',
    municipality: 'Lyon',
    lat: 45.7606,
    lon: 4.8591,
    country: 'FR',
    tz: 'Europe/Paris',
  },
  {
    slug: 'zurich-hb',
    uic: null,
    name: 'Zürich HB',
    municipality: 'Zürich',
    lat: 47.3779,
    lon: 8.5403,
    country: 'CH',
    tz: 'Europe/Zurich',
  },
  {
    slug: 'london-st-pancras',
    uic: null,
    name: 'London St Pancras International',
    municipality: 'London',
    lat: 51.5322,
    lon: -0.1263,
    country: 'GB',
    tz: 'Europe/London',
  },
  {
    slug: 'paris-gare-du-nord',
    uic: null,
    name: 'Paris Gare du Nord',
    municipality: 'Paris',
    lat: 48.8809,
    lon: 2.3553,
    country: 'FR',
    tz: 'Europe/Paris',
  },
] as const;

export const seedJourney = async (db: Kysely<DB>, userId: string) => {
  // The stations are created as custom stations, so they never clash with the
  // synced station list.
  const createdStations = new Map<string, number>();

  for (const { slug, ...stationData } of seedStations) {
    const code = `custom-seed-${slug}`;
    const existing = await db
      .selectFrom('station')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirst();

    if (existing) {
      createdStations.set(slug, existing.id);
    } else {
      const newStation = await db
        .insertInto('station')
        .values({
          ...stationData,
          code,
          viaggiatrenoId: null,
          type: 'main',
          continent: 'EU',
          custom: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      createdStations.set(slug, newStation.id);
    }
  }

  // Create journey factory that uses station IDs
  const baseJourneyFactory = Factory.makeFactory<CreateJourney>({
    passengers: [{ userId: 'PLACEHOLDER' }],
    from: Factory.each((i) => ({
      // @ts-expect-error - TS doesn't understand the modulo operation
      id: createdStations.get(routes[i % routes.length].from)!,
    })),
    to: Factory.each((i) => ({
      // @ts-expect-error - TS doesn't understand the modulo operation
      id: createdStations.get(routes[i % routes.length].to)!,
    })),
    // @ts-expect-error - TS doesn't understand the modulo operation
    duration: Factory.each((i) => routes[i % routes.length].duration),
    date: Factory.each(() =>
      format(
        new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000), // Random date within the last 10 years
        'yyyy-MM-dd',
      ),
    ),
  });

  const journeys = baseJourneyFactory.buildList(10, {
    passengers: [
      {
        userId,
        seat: 'window',
        coach: '5',
        seatNumber: '11A',
        seatClass: 'second',
      },
    ],
  });

  // Insert journeys directly with proper foreign key relationships
  await db.transaction().execute(async (trx) => {
    const insertedJourneys = await trx
      .insertInto('journey')
      .values(
        journeys.map(
          ({ passengers: _, from, to, train, operator, ...journeyData }) => ({
            ...journeyData,
            fromId: from.id,
            toId: to.id,
            trainId: train?.id ?? null,
            operatorId: operator?.id ?? null,
          }),
        ),
      )
      .returning('id')
      .execute();

    // Insert passengers for each journey
    const passengerData = insertedJourneys.flatMap((journey, index) => {
      const journeyInput = journeys[index];

      if (journeyInput && journeyInput.passengers.length > 0) {
        return journeyInput.passengers.map((passenger) => ({
          journeyId: journey.id,
          userId: passenger.userId,
          guestName: passenger.guestName,
          seat: passenger.seat,
          coach: passenger.coach,
          seatNumber: passenger.seatNumber,
          seatClass: passenger.seatClass,
          journeyReason: passenger.journeyReason,
        }));
      }

      return [];
    });

    if (passengerData.length > 0) {
      await trx.insertInto('journeyPassenger').values(passengerData).execute();
    }
  });
};
