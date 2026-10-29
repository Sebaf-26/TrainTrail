import type { TZDate } from '@date-fns/tz';
import { differenceInSeconds, isBefore, parseISO } from 'date-fns';
import { type Insertable, sql } from 'kysely';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

import { db } from '$lib/db';
import { scheduleRailRoutes } from '$lib/server/utils/rail-route';
import {
  createJourneyPrimitive,
  createJourneyPrimitiveWithConnection,
  createManyJourneysPrimitive,
  getJourneyPrimitive,
  listAllJourneysPrimitive,
  listJourneyBaseQuery,
  listJourneyPrimitive,
  listGuestNamesPrimitive,
  PassengerResolutionError,
  resolveJourneyPassengerChanges,
  updateJourneyPrimitive,
  updateJourneyPrimitiveWithConnection,
  upsertJourneyTicketPrimitiveWithConnection,
  upsertJourneyTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import type { DB } from '$lib/db/schema';
import type { CreateJourney, DatabaseConnection, Journey } from '$lib/db/types';
import type { ResolvedJourneyScope } from '$lib/journey-scope';
import { AuthorizationError } from '$lib/server/authorization/authorize';
import type { AuthorizationContext } from '$lib/server/authorization/context';
import {
  canAccessResolvedOwnership,
  canCreateJourney,
  journeyOwnership,
} from '$lib/server/authorization/journey';
import { journeyScope, type ApiScope } from '$lib/api/v1/scopes';
import {
  CustomFieldValidationError,
  persistEntityCustomFieldPlan,
  prepareEntityCustomFieldPlan,
  validateEntityCustomFieldPlan,
  type EntityCustomFieldPlan,
} from '$lib/server/utils/custom-fields';
import {
  getMissingJourneyReferenceUpdate,
  getMissingImportPassengers,
  type MissingJourneyReferenceUpdate,
  type JourneyImportMode,
} from '$lib/server/utils/journey-import';
import { distanceBetween } from '$lib/utils';
import {
  estimateJourneyDuration,
  isBeforeEpoch,
  mergeTimeWithDate,
  parseLocalISO,
  toUtc,
} from '$lib/utils/datetime';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { journeySchema } from '$lib/zod/journey';

const assertDateOrder = (
  start: Date | null | undefined,
  end: Date | null | undefined,
): boolean => {
  if (!start || !end) return true;
  return !isBefore(end, start);
};

type PassengerRecord = Pick<
  CreateJourney['passengers'][number],
  | 'id'
  | 'userId'
  | 'guestName'
  | 'seat'
  | 'coach'
  | 'seatNumber'
  | 'seatClass'
  | 'journeyReason'
>;
type ExistingPassengerRecord = PassengerRecord & { id: number };

const canonicalPassengerRecords = (passengers: readonly PassengerRecord[]) =>
  passengers
    .map((passenger) => [
      passenger.id === undefined ? null : passenger.id,
      passenger.userId,
      passenger.guestName,
      passenger.seat,
      passenger.coach,
      passenger.seatNumber,
      passenger.seatClass,
      passenger.journeyReason,
    ])
    .sort((left, right) => {
      const leftId = left[0];
      const rightId = right[0];
      if (typeof leftId === 'number' && typeof rightId === 'number') {
        return leftId - rightId;
      }
      if (typeof leftId === 'number') return -1;
      if (typeof rightId === 'number') return 1;
      return String(left[1] ?? left[2]).localeCompare(
        String(right[1] ?? right[2]),
      );
    });

export const passengerRecordsChanged = (
  existing: readonly ExistingPassengerRecord[],
  incoming: readonly PassengerRecord[],
) => {
  const resolvedIncoming = resolveJourneyPassengerChanges(
    [...existing],
    [...incoming],
  ).resolved.map(({ passenger, existing: resolvedExisting }) => ({
    ...passenger,
    id: resolvedExisting?.id ?? passenger.id,
  }));
  return !isDeepStrictEqual(
    canonicalPassengerRecords(existing),
    canonicalPassengerRecords(resolvedIncoming),
  );
};

export const validateJourneyDates = (journey: CreateJourney): string | null => {
  const pairs: [string | null, string | null, string][] = [
    [journey.departure, journey.arrival, 'Arrival must be after departure'],
    [
      journey.departureScheduled,
      journey.arrivalScheduled,
      'Scheduled arrival must be after scheduled departure',
    ],
  ];

  for (const [start, end, message] of pairs) {
    if (
      !assertDateOrder(
        start ? parseISO(start) : null,
        end ? parseISO(end) : null,
      )
    ) {
      return message;
    }
  }

  return null;
};

export const listJourneysQuery = (userId: string) => {
  return listJourneyBaseQuery(db, userId);
};

export const listJourneys = async (userId: string) => {
  return await listJourneyPrimitive(db, userId);
};

export const listAllJourneys = async () => {
  return await listAllJourneysPrimitive(db);
};

export const listGuestNames = async (userId: string) => {
  return await listGuestNamesPrimitive(db, userId);
};

export const listJourneysInScope = async (scope: ResolvedJourneyScope) =>
  scope.scope === 'all'
    ? await listAllJourneys()
    : await listJourneys(scope.userId);

export const getJourney = async (id: number) => {
  return await getJourneyPrimitive(db, id);
};

export const createJourney = async (data: CreateJourney) => {
  const id = await createJourneyPrimitive(db, data);
  scheduleRailRoutes([id]);
  return id;
};

type JourneyAggregatePlan = {
  journeyPlan: EntityCustomFieldPlan;
  passengerPlan: EntityCustomFieldPlan;
  /** True when the passenger set or any passenger's custom fields changed. */
  passengersChanged: boolean;
};

/** Custom-field plans and the passenger-change decision. `existing` is null for a create. */
export const planJourneyAggregate = async (
  trx: DatabaseConnection,
  {
    existing,
    values,
    customFields,
  }: {
    existing: Pick<Journey, 'id' | 'passengers'> | null;
    values: CreateJourney;
    customFields: Record<string, unknown>;
  },
): Promise<JourneyAggregatePlan> => {
  const passengerChanges = existing
    ? resolveJourneyPassengerChanges(existing.passengers, values.passengers)
    : null;
  const passengerEntities = passengerChanges
    ? passengerChanges.resolved.map(({ passenger, existing: resolved }) => ({
        entityId: resolved ? String(resolved.id) : null,
        values: passenger.customFields,
      }))
    : values.passengers.map((passenger) => ({
        entityId: null,
        values: passenger.customFields,
      }));
  const journeyPlan = await prepareEntityCustomFieldPlan(trx, {
    entityType: 'journey',
    entities: [
      { entityId: existing ? String(existing.id) : null, values: customFields },
    ],
  });
  const passengerPlan = await prepareEntityCustomFieldPlan(trx, {
    entityType: 'journey_passenger',
    entities: passengerEntities,
  });
  const passengersChanged = existing
    ? passengerRecordsChanged(existing.passengers, values.passengers) ||
      passengerPlan.entities.some(({ changed }) => changed)
    : true;
  return { journeyPlan, passengerPlan, passengersChanged };
};

/*
 * Writes a planned journey aggregate -- journey row, passengers, custom fields and
 * track -- inside the caller's transaction, validating the plans first.
 * Returns the journey id.
 */
export const persistJourneyAggregate = async (
  trx: DatabaseConnection,
  {
    existing,
    values,
    plan,
  }: {
    existing: Pick<Journey, 'id'> | null;
    values: CreateJourney;
    plan: JourneyAggregatePlan;
  },
): Promise<number> => {
  validateEntityCustomFieldPlan(plan.journeyPlan);
  if (plan.passengersChanged) validateEntityCustomFieldPlan(plan.passengerPlan);
  if (existing) {
    const persisted = await updateJourneyPrimitiveWithConnection(
      trx,
      existing.id,
      values,
    );
    await persistEntityCustomFieldPlan(trx, plan.journeyPlan, [
      String(existing.id),
    ]);
    if (plan.passengersChanged)
      await persistEntityCustomFieldPlan(
        trx,
        plan.passengerPlan,
        persisted.map(({ id }) => String(id)),
      );
    return existing.id;
  }
  const created = await createJourneyPrimitiveWithConnection(trx, values);
  await persistEntityCustomFieldPlan(trx, plan.journeyPlan, [
    String(created.journeyId),
  ]);
  await persistEntityCustomFieldPlan(
    trx,
    plan.passengerPlan,
    created.passengers.map(({ id }) => String(id)),
  );
  return created.journeyId;
};

/**
 * Who is writing a journey: their role, and for API callers the check that their
 * credential carries a scope. Session callers have no credential to check.
 */
export type JourneyWriter = {
  authorization: AuthorizationContext;
  requireScope: (scope: ApiScope) => void;
};

export const sessionJourneyWriter = (
  authorization: AuthorizationContext,
): JourneyWriter => ({ authorization, requireScope: () => {} });

/*
 * The authorization and write of a journey aggregate, shared by the web form,
 * the legacy API, v1 REST and MCP. Role denials throw AuthorizationError and
 * credential denials come from `writer.requireScope`, so every surface enforces
 * the same rules against the same `plan.passengersChanged` the write uses.
 */
export const saveJourneyAggregate = async (
  { authorization, requireScope }: JourneyWriter,
  {
    id,
    values,
    customFields,
  }: {
    id: number | null;
    values: CreateJourney;
    customFields: Record<string, unknown>;
  },
): Promise<number> => {
  // A null track deletes the stored one, so any track in the payload is a write.
  if (values.track !== undefined) requireScope('tracks.write');

  if (id === null) {
    const ownership = values.passengers.some(
      (passenger) => passenger.userId === authorization.userId,
    )
      ? 'own'
      : 'any';
    if (!canCreateJourney(authorization, values.passengers))
      throw new AuthorizationError(
        'The current role cannot create this journey',
      );
    requireScope(journeyScope('create', ownership));
    if (values.passengers.length > 1)
      requireScope(journeyScope('passengers.manage', ownership));
    const created = await db.transaction().execute(async (trx) => {
      const plan = await planJourneyAggregate(trx, {
        existing: null,
        values,
        customFields,
      });
      return persistJourneyAggregate(trx, { existing: null, values, plan });
    });
    scheduleRailRoutes([created]);
    return created;
  }

  const updated = await db.transaction().execute(async (trx) => {
    const existing = await getJourneyPrimitive(trx, id);
    if (!existing) throw new AuthorizationError('Journey not found', 404);
    const ownership = await journeyOwnership(authorization.userId, id, trx);
    if (!canAccessResolvedOwnership(authorization, 'update', ownership))
      throw new AuthorizationError('Journey not found', 404);
    requireScope(journeyScope('update', ownership));

    const plan = await planJourneyAggregate(trx, {
      existing,
      values,
      customFields,
    });
    if (plan.passengersChanged) {
      if (
        !canAccessResolvedOwnership(
          authorization,
          'passengers.manage',
          ownership,
        )
      )
        throw new AuthorizationError('Journey not found', 404);
      requireScope(journeyScope('passengers.manage', ownership));
    }
    return persistJourneyAggregate(trx, { existing, values, plan });
  });
  // Changed stations make a computed route stale; it is redrawn when it no
  // longer fits them.
  scheduleRailRoutes([updated]);
  return updated;
};

type JourneyFormValues = {
  values: CreateJourney;
  customFields: Record<string, unknown>;
};

/** Converts a submitted journey form into the values a write stores. */
export const journeyValuesFromForm = (
  data: z.infer<typeof journeySchema>,
): ErrorActionResult | JourneyFormValues => {
  const pathError = (path: string, message: string): ErrorActionResult => {
    return { success: false, type: 'path', path, message };
  };

  const toCanonicalDate = (iso: string) => iso.slice(0, 10);

  const parseDateTimeField = (
    date: string | null,
    time: string | null,
    tzId: string,
    path: string,
  ) => {
    if (!date || !time) return { value: null as TZDate | null };
    try {
      return { value: mergeTimeWithDate(date, time, tzId) };
    } catch {
      return { error: pathError(path, 'Invalid time format') };
    }
  };

  const from = data.from;
  const to = data.to;

  const {
    datePrecision,
    trainNumber,
    train,
    unitNumber,
    operator,
    note,
    departurePlatform,
    arrivalPlatform,
    customFields = {},
    track,
  } = data;

  if (data.datePrecision !== 'day') {
    if (!data.departure) {
      return pathError('departure', 'Enter a 4-digit departure year');
    }

    const departureDate = parseISO(data.departure);
    if (isBeforeEpoch(departureDate)) {
      return pathError('departure', 'Too far in the past');
    }

    let duration: number | null = null;
    if (from.id !== to.id) {
      const fromLonLat = { lon: from.lon, lat: from.lat };
      const toLonLat = { lon: to.lon, lat: to.lat };
      duration = estimateJourneyDuration(
        distanceBetween(fromLonLat, toLonLat) / 1000,
      );
    }

    const values = {
      from,
      to,
      duration,
      departure: data.departure,
      arrival: null,
      departureScheduled: null,
      arrivalScheduled: null,
      departurePlatform: departurePlatform ?? null,
      arrivalPlatform: arrivalPlatform ?? null,
      date: toCanonicalDate(data.departure),
      datePrecision,
      trainNumber,
      train,
      unitNumber,
      operator,
      note,
      passengers: data.passengers,
      track,
    };

    return { values, customFields };
  }

  // Either departure or departureScheduled must be set
  if (!data.departure && !data.departureScheduled) {
    return pathError('departure', 'Select a departure date');
  }

  // Use departure if available, otherwise fall back to departureScheduled for the date field
  const primaryDepartureDate = data.departure ?? data.departureScheduled;
  const departureDate = parseISO(primaryDepartureDate!);
  if (isBeforeEpoch(departureDate)) {
    // Y2K38
    return pathError(
      data.departure ? 'departure' : 'departureScheduled',
      'Too far in the past',
    );
  }

  let departure: TZDate | undefined;
  if (data.departure) {
    try {
      departure = data.departureTime
        ? mergeTimeWithDate(data.departure, data.departureTime, from.tz)
        : undefined;
    } catch {
      return pathError('departureTime', 'Invalid time format');
    }
  }

  const departureScheduledResult = parseDateTimeField(
    data.departureScheduled,
    data.departureScheduledTime,
    from.tz,
    'departureScheduledTime',
  );
  if (departureScheduledResult.error) return departureScheduledResult.error;
  const departureScheduled = departureScheduledResult.value;

  const arrivalDate = data.arrival
    ? parseLocalISO(data.arrival, to.tz)
    : undefined;
  if (arrivalDate && isBeforeEpoch(arrivalDate)) {
    return pathError('arrival', 'Too far in the past');
  }
  if (arrivalDate && !data.arrivalTime) {
    return pathError('arrival', 'Cannot have arrival date without time');
  }

  if (data.arrivalTime && !data.arrival) {
    data.arrival = data.departure;
  }

  let arrival: TZDate | undefined;
  try {
    arrival =
      data.arrival && data.arrivalTime
        ? mergeTimeWithDate(data.arrival, data.arrivalTime, to.tz)
        : undefined;
  } catch {
    return pathError('arrivalTime', 'Invalid time format');
  }

  const arrivalScheduledResult = parseDateTimeField(
    data.arrivalScheduled,
    data.arrivalScheduledTime,
    to.tz,
    'arrivalScheduledTime',
  );
  if (arrivalScheduledResult.error) return arrivalScheduledResult.error;
  const arrivalScheduled = arrivalScheduledResult.value;

  if (!assertDateOrder(departure, arrival)) {
    return pathError('arrival', 'Arrival must be after departure');
  }

  if (!assertDateOrder(departureScheduled, arrivalScheduled)) {
    return pathError(
      'arrivalScheduled',
      'Scheduled arrival must be after scheduled departure',
    );
  }

  let duration: number | null = null;
  if (departure && arrival) {
    duration = differenceInSeconds(arrival, departure);
  } else if (from.id !== to.id) {
    // if the stations are the same, the duration can't be calculated
    const fromLonLat = { lon: from.lon, lat: from.lat };
    const toLonLat = { lon: to.lon, lat: to.lat };
    duration = estimateJourneyDuration(
      distanceBetween(fromLonLat, toLonLat) / 1000,
    );
  }

  const values = {
    from,
    to,
    duration,
    departure: departure ? toUtc(departure).toISOString() : null,
    arrival: arrival ? toUtc(arrival).toISOString() : null,
    departureScheduled: departureScheduled
      ? toUtc(departureScheduled).toISOString()
      : null,
    arrivalScheduled: arrivalScheduled
      ? toUtc(arrivalScheduled).toISOString()
      : null,
    departurePlatform: departurePlatform ?? null,
    arrivalPlatform: arrivalPlatform ?? null,
    date: toCanonicalDate(primaryDepartureDate!),
    datePrecision,
    trainNumber,
    train,
    unitNumber,
    operator,
    note,
    passengers: data.passengers,
    track,
  };

  return { values, customFields };
};

export const validateAndSaveJourney = async (
  writer: JourneyWriter,
  data: z.infer<typeof journeySchema>,
): Promise<ErrorActionResult> => {
  const prepared = journeyValuesFromForm(data);
  if (!('values' in prepared)) return prepared;
  const updating = Boolean(data.id);
  try {
    const id = await saveJourneyAggregate(writer, {
      id: data.id ?? null,
      ...prepared,
    });
    return updating
      ? { success: true, message: 'Journey updated successfully' }
      : { success: true, message: 'Journey added', id };
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return {
        success: false,
        type: 'httpError',
        status: e.status,
        message: e.message,
      };
    }
    if (
      e instanceof CustomFieldValidationError ||
      e instanceof PassengerResolutionError
    ) {
      return { success: false, type: 'error', message: e.message };
    }
    console.error('Failed to save journey', e);
    return {
      success: false,
      type: 'error',
      message: updating ? 'Failed to update journey' : 'Failed to add journey',
    };
  }
};

export const deleteJourney = async (id: number) => {
  return await db.deleteFrom('journey').where('id', '=', id).executeTakeFirst();
};

export const updateJourney = async (id: number, data: CreateJourney) => {
  return await updateJourneyPrimitive(db, id, data);
};

const signature = (f: CreateJourney) => {
  const from = f.from?.id ?? null;
  const to = f.to?.id ?? null;
  return [
    f.date ?? '',
    f.datePrecision ?? 'day',
    from ?? '',
    to ?? '',
    f.trainNumber ?? '',
    f.unitNumber ?? '',
    f.departure ?? '',
    f.arrival ?? '',
  ].join('|');
};

/**
 * Save journeys produced by an importer. TrainTrail backup custom fields are
 * export-only metadata and are intentionally not restored here.
 */
export const createManyJourneys = async (
  data: CreateJourney[],
  userId: string,
  dedupe = true,
  mode: JourneyImportMode = 'personal',
): Promise<{
  insertedJourneys: number;
  updatedJourneys: number;
  attachedPassengers: number;
}> => {
  if (!dedupe) {
    const insertedJourneys = data.length;
    const attachedPassengers = data.reduce(
      (acc, f) => acc + (f.passengers?.length ?? 0),
      0,
    );
    scheduleRailRoutes(await createManyJourneysPrimitive(db, data));
    return { insertedJourneys, updatedJourneys: 0, attachedPassengers };
  }

  // Deduplicate within incoming data
  const uniqueMap = new Map<string, CreateJourney>();
  for (const f of data) {
    const key = signature(f);
    if (!uniqueMap.has(key)) uniqueMap.set(key, f);
  }
  const uniqueJourneys = Array.from(uniqueMap.values());

  if (uniqueJourneys.length === 0)
    return { insertedJourneys: 0, updatedJourneys: 0, attachedPassengers: 0 };

  // Gather candidate filters
  const dates = new Set(uniqueJourneys.map((f) => f.date));
  const froms = new Set(
    uniqueJourneys.map((f) => f.from?.id).filter((id): id is number => !!id),
  );
  const tos = new Set(
    uniqueJourneys.map((f) => f.to?.id).filter((id): id is number => !!id),
  );

  // Fetch existing journeys for candidate space
  let existingJourneys: Journey[] = [];

  if (dates.size && froms.size && tos.size) {
    const listQuery =
      mode === 'restore' ? listJourneyBaseQuery(db) : listJourneysQuery(userId);
    existingJourneys = await listQuery
      .where('date', 'in', Array.from(dates))
      .where('fromId', 'in', Array.from(froms))
      .where('toId', 'in', Array.from(tos))
      .execute();
  }

  const existingBySig = new Map<string, Journey>();
  for (const ef of existingJourneys) {
    const key = signature(ef);
    if (!existingBySig.has(key)) existingBySig.set(key, ef);
  }

  const userPassengerByJourney = new Set<number>();
  const existingPassengersByJourney = new Map<
    number,
    Journey['passengers'][number][]
  >();
  for (const journey of existingJourneys) {
    existingPassengersByJourney.set(journey.id, journey.passengers);
    if (journey.passengers.some((passenger) => passenger.userId === userId)) {
      userPassengerByJourney.add(journey.id);
    }
  }

  const journeysToInsert: CreateJourney[] = [];
  type PassengerInsert = Insertable<DB['journeyPassenger']>;
  const passengersToAttach: PassengerInsert[] = [];
  const tracksToUpsert: Array<{
    journeyId: number;
    track: NonNullable<CreateJourney['track']>;
  }> = [];
  const referenceUpdates: Array<{
    journeyId: number;
    update: MissingJourneyReferenceUpdate;
  }> = [];
  const ticketsToUpsert: Array<{
    journeyId: number;
    ticket: NonNullable<CreateJourney['ticket']>;
  }> = [];

  for (const f of uniqueJourneys) {
    const key = signature(f);
    const existingJourney = existingBySig.get(key);
    if (existingJourney) {
      const existingId = existingJourney.id;
      if (f.track) {
        tracksToUpsert.push({ journeyId: existingId, track: f.track });
      }
      if (f.ticket) {
        ticketsToUpsert.push({ journeyId: existingId, ticket: f.ticket });
      }
      const referenceUpdate = getMissingJourneyReferenceUpdate(
        existingJourney,
        f,
      );
      if (referenceUpdate) {
        referenceUpdates.push({
          journeyId: existingId,
          update: referenceUpdate,
        });
      }

      // Personal imports only deduplicate journeys already owned by the importer.
      if (mode === 'personal' && userPassengerByJourney.has(existingId)) {
        continue;
      }

      const missingPassengers = getMissingImportPassengers(
        existingPassengersByJourney.get(existingId) ?? [],
        f.passengers,
      );
      for (const passenger of missingPassengers) {
        passengersToAttach.push({
          journeyId: existingId,
          userId: passenger.userId,
          guestName: passenger.guestName,
          seat: passenger.seat,
          coach: passenger.coach,
          seatNumber: passenger.seatNumber,
          seatClass: passenger.seatClass,
          journeyReason: passenger.journeyReason,
        });
      }
      continue;
    }
    journeysToInsert.push(f);
  }

  // Insert new journeys and their passengers
  let insertedJourneys = 0;
  if (journeysToInsert.length) {
    scheduleRailRoutes(await createManyJourneysPrimitive(db, journeysToInsert));
    insertedJourneys = journeysToInsert.length;
  }

  // Enrich and attach data to existing journeys.
  const updatedJourneys = referenceUpdates.length;
  let attachedPassengers = 0;
  if (
    referenceUpdates.length ||
    passengersToAttach.length ||
    tracksToUpsert.length ||
    ticketsToUpsert.length
  ) {
    await db.transaction().execute(async (trx) => {
      for (const { journeyId, update } of referenceUpdates) {
        if (update.operatorId != null) {
          await trx
            .updateTable('journey')
            .set({ operatorId: update.operatorId })
            .where('id', '=', journeyId)
            .where('operatorId', 'is', null)
            .execute();
        }
        if (update.trainId != null) {
          await trx
            .updateTable('journey')
            .set({ trainId: update.trainId })
            .where('id', '=', journeyId)
            .where('trainId', 'is', null)
            .execute();
        }
      }

      for (const { journeyId, track } of tracksToUpsert) {
        await upsertJourneyTrackPrimitiveWithConnection(trx, journeyId, track);
      }

      // A re-imported ticket replaces the one kept for the importing user.
      for (const { journeyId, ticket } of ticketsToUpsert) {
        await upsertJourneyTicketPrimitiveWithConnection(
          trx,
          journeyId,
          userId,
          ticket,
        );
      }

      if (passengersToAttach.length) {
        await trx
          .insertInto('journeyPassenger')
          .values(passengersToAttach)
          .execute();
        attachedPassengers = passengersToAttach.length;
      }
    });
  }

  return { insertedJourneys, updatedJourneys, attachedPassengers };
};
