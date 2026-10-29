import { type Expression, type Kysely, type Selectable, sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

import type { DB } from './schema';
import type {
  CreateJourney,
  CreateJourneyPassenger,
  JourneyTicketInput,
} from './types';

import {
  journeyTrackInputSchema,
  toJourneyTrackPayload,
  type JourneyTrackInput,
} from '$lib/track/schema';
import { journeyTicketInputSchema } from '$lib/zod/journey-ticket';

const stationColumns = [
  'id',
  'code',
  'uic',
  'viaggiatrenoId',
  'lat',
  'lon',
  'tz',
  'name',
  'municipality',
  'type',
  'continent',
  'country',
  'custom',
] as const;

const stationForClient = (db: Kysely<DB>) => {
  return db.selectFrom('station').select(stationColumns);
};

const stations = (
  db: Kysely<DB>,
  from: Expression<number | null>,
  to: Expression<number | null>,
) => {
  return [
    jsonObjectFrom(stationForClient(db).where('station.id', '=', from)).as(
      'from',
    ),
    jsonObjectFrom(stationForClient(db).where('station.id', '=', to)).as('to'),
  ];
};

const train = (db: Kysely<DB>, id: Expression<number | null>) => {
  return jsonObjectFrom(
    db.selectFrom('train').selectAll().where('train.id', '=', id),
  ).as('train');
};

const operator = (db: Kysely<DB>, id: Expression<number | null>) => {
  return jsonObjectFrom(
    db.selectFrom('operator').selectAll().where('operator.id', '=', id),
  ).as('operator');
};

type ExistingPassengerIdentity = Pick<
  Selectable<DB['journeyPassenger']>,
  'id' | 'userId' | 'guestName'
>;

const passengerIdentity = (passenger: {
  userId: string | null;
  guestName: string | null;
}) =>
  passenger.userId
    ? `user:${passenger.userId}`
    : `guest:${passenger.guestName}`;

/** A submitted passenger list that cannot be matched to the stored one. */
export class PassengerResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PassengerResolutionError';
  }
}

export const resolveJourneyPassengerChanges = (
  existingPassengers: ExistingPassengerIdentity[],
  incomingPassengers: CreateJourneyPassenger[],
) => {
  const byId = new Map(
    existingPassengers.map((passenger) => [passenger.id, passenger]),
  );
  const byIdentity = new Map(
    existingPassengers.map((passenger) => [
      passengerIdentity(passenger),
      passenger,
    ]),
  );
  const retainedIds = new Set<number>();
  const resolved = incomingPassengers.map((passenger) => {
    const existing = passenger.id
      ? byId.get(passenger.id)
      : byIdentity.get(passengerIdentity(passenger));
    if (passenger.id && !existing) {
      throw new PassengerResolutionError(
        'Passenger does not belong to this journey',
      );
    }
    if (existing && retainedIds.has(existing.id)) {
      throw new PassengerResolutionError(
        'Passenger record appears more than once',
      );
    }
    if (existing) retainedIds.add(existing.id);
    return { passenger, existing };
  });
  const removedIds = existingPassengers
    .filter((passenger) => !retainedIds.has(passenger.id))
    .map((passenger) => passenger.id);

  return { resolved, removedIds };
};

const passengers = (db: Kysely<DB>, journeyId: Expression<number>) => {
  return jsonArrayFrom(
    db
      .selectFrom('journeyPassenger')
      .selectAll('journeyPassenger')
      .select(({ ref }) => [
        jsonObjectFrom(
          db
            .selectFrom('user')
            .select(['user.id', 'user.displayName', 'user.username'])
            .whereRef('user.id', '=', ref('journeyPassenger.userId')),
        ).as('user'),
      ])
      .whereRef('journeyPassenger.journeyId', '=', journeyId),
  ).as('passengers');
};

export const listJourneyBaseQuery = (db: Kysely<DB>, userId?: string) => {
  let query = db
    .selectFrom('journey')
    .selectAll('journey')
    .select((eb) =>
      stations(db, eb.ref('journey.fromId'), eb.ref('journey.toId')),
    )
    .select(({ ref }) => [train(db, ref('journey.trainId'))])
    .select(({ ref }) => [operator(db, ref('journey.operatorId'))])
    .select((eb) => [passengers(db, eb.ref('journey.id'))])
    // The length along the rails, when a route was computed for the journey.
    .select((eb) =>
      eb
        .selectFrom('journeyTrack')
        .select('journeyTrack.lengthM')
        .whereRef('journeyTrack.journeyId', '=', 'journey.id')
        .where('journeyTrack.sourceFormat', '=', 'rail')
        .as('railDistanceM'),
    );

  if (!userId) {
    return query;
  }

  query = query.where((eb) =>
    eb.exists(
      eb
        .selectFrom('journeyPassenger')
        .select('journeyPassenger.id')
        .whereRef('journeyPassenger.journeyId', '=', 'journey.id')
        .where('journeyPassenger.userId', '=', userId),
    ),
  );

  return query;
};

export const listJourneyPrimitive = async (db: Kysely<DB>, userId: string) => {
  const listQuery = listJourneyBaseQuery(db, userId);

  return await listQuery.execute();
};

export const listAllJourneysPrimitive = async (db: Kysely<DB>) => {
  return await listJourneyBaseQuery(db).execute();
};

export const listGuestNamesPrimitive = async (
  db: Kysely<DB>,
  userId: string,
) => {
  const guestName = sql.ref<string>('guest.guestName');
  // Case and whitespace variants count as one guest, shown with their most
  // used spelling.
  const rows = await db
    .selectFrom('journeyPassenger as guest')
    .select([
      sql<string>`mode() within group (order by trim(${guestName}))`.as('name'),
      (eb) => eb.fn.count<string>('guest.journeyId').distinct().as('count'),
    ])
    .where('guest.guestName', 'is not', null)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('journeyPassenger as owner')
          .select('owner.id')
          .whereRef('owner.journeyId', '=', 'guest.journeyId')
          .where('owner.userId', '=', userId),
      ),
    )
    .groupBy(sql`lower(trim(${guestName}))`)
    .orderBy('count', 'desc')
    .orderBy('name')
    .execute();

  return rows.map(({ name, count }) => ({ name, count: Number(count) }));
};

export const getJourneyPrimitive = async (db: Kysely<DB>, id: number) => {
  return await db
    .selectFrom('journey')
    .selectAll()
    .select(({ ref }) =>
      stations(db, ref('journey.fromId'), ref('journey.toId')),
    )
    .select(({ ref }) => [train(db, ref('journey.trainId'))])
    .select(({ ref }) => [operator(db, ref('journey.operatorId'))])
    .select((eb) => [passengers(db, eb.ref('journey.id'))])
    .where('id', '=', id)
    .executeTakeFirst();
};

export const createJourneyPrimitive = async (
  db: Kysely<DB>,
  data: CreateJourney,
) => {
  return await db.transaction().execute(async (trx) => {
    const result = await createJourneyPrimitiveWithConnection(trx, data);
    return result.journeyId;
  });
};

export const updateJourneyPrimitive = async (
  db: Kysely<DB>,
  id: number,
  data: CreateJourney,
) => {
  await db
    .transaction()
    .execute(async (trx) =>
      updateJourneyPrimitiveWithConnection(trx, id, data),
    );
};

export const createJourneyPrimitiveWithConnection = async (
  db: Kysely<DB>,
  data: CreateJourney,
) => {
  if (!data.passengers.length) {
    throw new Error('Journey must have at least one passenger');
  }

  const {
    passengers,
    from,
    to,
    train,
    operator,
    track,
    ticket,
    ...journeyData
  } = data;
  const fromId = from?.id ?? null;
  const toId = to?.id ?? null;
  const trainId = train?.id ?? null;
  const operatorId = operator?.id ?? null;

  const resp = await db
    .insertInto('journey')
    .values({
      ...journeyData,
      fromId,
      toId,
      trainId,
      operatorId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const persistedPassengers: Array<{
    id: number;
    input: CreateJourneyPassenger;
  }> = [];
  for (const passenger of passengers) {
    const created = await db
      .insertInto('journeyPassenger')
      .values({
        journeyId: resp.id,
        userId: passenger.userId,
        guestName: passenger.guestName,
        seat: passenger.seat,
        coach: passenger.coach,
        seatNumber: passenger.seatNumber,
        seatClass: passenger.seatClass,
        journeyReason: passenger.journeyReason,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    persistedPassengers.push({ id: created.id, input: passenger });
  }

  if (track) {
    await upsertJourneyTrackPrimitiveWithConnection(db, resp.id, track);
  }

  const ticketOwner = firstUserPassenger(passengers);
  if (ticket && ticketOwner) {
    await upsertJourneyTicketPrimitiveWithConnection(
      db,
      resp.id,
      ticketOwner,
      ticket,
    );
  }

  return {
    journeyId: resp.id,
    passengers: persistedPassengers,
  };
};

export const updateJourneyPrimitiveWithConnection = async (
  db: Kysely<DB>,
  id: number,
  data: CreateJourney,
) => {
  const {
    passengers,
    from,
    to,
    train,
    operator,
    track,
    ticket,
    ...journeyData
  } = data;
  if (!from || !to) {
    throw new Error('Both departure and arrival stations are required');
  }
  if (!Number.isFinite(from.id) || !Number.isFinite(to.id)) {
    throw new Error('Both departure and arrival stations must have IDs');
  }
  const fromId = Number(from.id);
  const toId = Number(to.id);
  const trainId = train?.id ?? null;
  const operatorId = operator?.id ?? null;

  await db
    .updateTable('journey')
    .set({
      ...journeyData,
      fromId,
      toId,
      trainId,
      operatorId,
    })
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  if (track !== undefined) {
    if (track === null) {
      await deleteJourneyTrackPrimitiveWithConnection(db, id);
    } else {
      await upsertJourneyTrackPrimitiveWithConnection(db, id, track);
    }
  }

  // Only a ticket in the payload is written: the journey form never sends one,
  // and removing a ticket has its own mutation.
  const ticketOwner = firstUserPassenger(passengers);
  if (ticket && ticketOwner) {
    await upsertJourneyTicketPrimitiveWithConnection(
      db,
      id,
      ticketOwner,
      ticket,
    );
  }

  if (!passengers.length) return [];

  const existingPassengers = await db
    .selectFrom('journeyPassenger')
    .select(['id', 'userId', 'guestName'])
    .where('journeyId', '=', id)
    .execute();
  const { resolved, removedIds } = resolveJourneyPassengerChanges(
    existingPassengers,
    passengers,
  );
  if (removedIds.length) {
    await db
      .deleteFrom('journeyPassenger')
      .where('id', 'in', removedIds)
      .execute();
  }

  const persistedPassengers: Array<{
    id: number;
    input: CreateJourneyPassenger;
  }> = [];
  for (const { passenger, existing } of resolved) {
    const values = {
      userId: passenger.userId,
      guestName: passenger.guestName,
      seat: passenger.seat,
      coach: passenger.coach,
      seatNumber: passenger.seatNumber,
      seatClass: passenger.seatClass,
      journeyReason: passenger.journeyReason,
    };
    if (existing) {
      await db
        .updateTable('journeyPassenger')
        .set(values)
        .where('id', '=', existing.id)
        .executeTakeFirstOrThrow();
      persistedPassengers.push({ id: existing.id, input: passenger });
    } else {
      const created = await db
        .insertInto('journeyPassenger')
        .values({ ...values, journeyId: id })
        .returning('id')
        .executeTakeFirstOrThrow();
      persistedPassengers.push({ id: created.id, input: passenger });
    }
  }
  return persistedPassengers;
};

const normalizeJourneyTrackInput = (
  track: JourneyTrackInput,
): JourneyTrackInput => journeyTrackInputSchema.parse(track);

export const upsertJourneyTrackPrimitiveWithConnection = async (
  db: Kysely<DB>,
  journeyId: number,
  track: JourneyTrackInput,
  /** The length of a route computed along the rails, in metres. */
  { lengthM = null }: { lengthM?: number | null } = {},
) => {
  const validTrack = normalizeJourneyTrackInput(track);
  const payload = toJourneyTrackPayload(validTrack);

  await db
    .insertInto('journeyTrack')
    .values({
      journeyId,
      track: payload,
      sourceFormat: validTrack.sourceFormat,
      sourceName: validTrack.sourceName ?? null,
      pointCount: validTrack.coordinates.length,
      lengthM,
      updatedAt: new Date(),
    })
    .onConflict((oc) =>
      oc.column('journeyId').doUpdateSet({
        track: payload,
        sourceFormat: validTrack.sourceFormat,
        sourceName: validTrack.sourceName ?? null,
        pointCount: validTrack.coordinates.length,
        // A track that replaces a computed route must not keep its length.
        lengthM,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }),
    )
    .executeTakeFirstOrThrow();
};

/** The user a ticket is kept for: the first passenger that is a user. */
const firstUserPassenger = (passengers: readonly CreateJourneyPassenger[]) =>
  passengers.find((passenger) => passenger.userId)?.userId ?? null;

export const upsertJourneyTicketPrimitiveWithConnection = async (
  db: Kysely<DB>,
  journeyId: number,
  userId: string,
  ticket: JourneyTicketInput,
) => {
  const valid = journeyTicketInputSchema.parse(ticket);

  await db
    .insertInto('journeyTicket')
    .values({ journeyId, userId, ...valid })
    .onConflict((oc) => oc.columns(['journeyId', 'userId']).doUpdateSet(valid))
    .execute();
};

/** The ticket kept for this user, never anyone else's. */
export const getJourneyTicketPrimitive = async (
  db: Kysely<DB>,
  journeyId: number,
  userId: string,
) => {
  const ticket = await db
    .selectFrom('journeyTicket')
    .select(['barcodeFormat', 'barcodeData', 'passengerName'])
    .where('journeyId', '=', journeyId)
    .where('userId', '=', userId)
    .executeTakeFirst();
  return ticket ?? null;
};

export const deleteJourneyTicketPrimitive = async (
  db: Kysely<DB>,
  journeyId: number,
  userId: string,
) => {
  const result = await db
    .deleteFrom('journeyTicket')
    .where('journeyId', '=', journeyId)
    .where('userId', '=', userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
};

export const deleteJourneyTrackPrimitiveWithConnection = async (
  db: Kysely<DB>,
  journeyId: number,
) => {
  await db
    .deleteFrom('journeyTrack')
    .where('journeyId', '=', journeyId)
    .execute();
};

export const createManyJourneysPrimitive = async (
  db: Kysely<DB>,
  data: CreateJourney[],
) => {
  if (data.some((journey) => !journey.passengers.length)) {
    throw new Error('Every journey must have at least one passenger');
  }

  return await db.transaction().execute(async (trx) => {
    const journeys = await trx
      .insertInto('journey')
      .values(
        data.map(
          ({
            passengers: _,
            from,
            to,
            train,
            operator,
            track: _track,
            ticket: _ticket,
            ...rest
          }) => ({
            ...rest,
            fromId: from?.id ?? null,
            toId: to?.id ?? null,
            trainId: train?.id ?? null,
            operatorId: operator?.id ?? null,
          }),
        ),
      )
      .returning('id')
      .execute();

    const passengerData = journeys.flatMap((journey, index) => {
      const journeyInput = data[index];

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

    await trx.insertInto('journeyPassenger').values(passengerData).execute();

    const trackData = journeys.flatMap((journey, index) => {
      const track = data[index]?.track
        ? normalizeJourneyTrackInput(data[index].track)
        : null;
      if (!track) return [];
      return [
        {
          journeyId: journey.id,
          track: toJourneyTrackPayload(track),
          sourceFormat: track.sourceFormat,
          sourceName: track.sourceName ?? null,
          pointCount: track.coordinates.length,
          updatedAt: new Date(),
        },
      ];
    });

    if (trackData.length) {
      await trx.insertInto('journeyTrack').values(trackData).execute();
    }

    const ticketData = journeys.flatMap((journey, index) => {
      const input = data[index];
      const owner = input ? firstUserPassenger(input.passengers) : null;
      if (!input?.ticket || !owner) return [];
      return [
        {
          journeyId: journey.id,
          userId: owner,
          ...journeyTicketInputSchema.parse(input.ticket),
        },
      ];
    });

    if (ticketData.length) {
      await trx.insertInto('journeyTicket').values(ticketData).execute();
    }

    return journeys.map(({ id }) => id);
  });
};

export const findStationsPrimitive = async (db: Kysely<DB>, input: string) => {
  const namePattern = `%${input}%`;
  const prefixPattern = `${input}%`;
  return await db
    .selectFrom('station')
    .select(stationColumns)
    .where((qb) =>
      qb.or([
        qb('code', 'ilike', input),
        qb('uic', 'ilike', input),
        qb('viaggiatrenoId', 'ilike', input),
        sql<boolean>`unaccent("name") ILIKE unaccent(${namePattern})` as any,
      ]),
    )
    .select([
      sql`CASE
              WHEN "code" ILIKE ${input} THEN 1
              WHEN "uic" ILIKE ${input} THEN 1
              WHEN "viaggiatreno_id" ILIKE ${input} THEN 1
              WHEN unaccent("name") ILIKE unaccent(${prefixPattern}) THEN 2
              WHEN unaccent("name") ILIKE unaccent(${namePattern}) THEN 3
              ELSE 4
            END`.as('match_rank'),
      sql`CASE
            WHEN "type" = 'main' THEN 1
            WHEN "type" = 'station' THEN 2
            ELSE 3
          END`.as('type_rank'),
    ])
    .orderBy('match_rank', 'asc')
    .orderBy('type_rank', 'asc')
    .limit(10)
    .execute();
};
