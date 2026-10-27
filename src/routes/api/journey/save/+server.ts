import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { getTrainByCode } from '$lib/server/utils/train';
import { getOperatorByCode } from '$lib/server/utils/operator';
import {
  getStationByCode,
  getStationByUic,
  getStationByViaggiatrenoId,
} from '$lib/server/utils/station';
import { apiJourneyWriter } from '$lib/server/api/v1/access';
import { apiError, legacyApiRoute } from '$lib/server/utils/api';
import {
  journeyValuesFromForm,
  saveJourneyAggregate,
} from '$lib/server/utils/journey';
import { trainSchema } from '$lib/zod/train';
import { operatorSchema } from '$lib/zod/operator';
import { journeySchema, validateJourneyDepartureDate } from '$lib/zod/journey';

const defaultJourney = {
  // from, to and departure are required
  datePrecision: 'day',
  arrival: null,
  arrivalScheduled: null,
  departureTime: null,
  arrivalTime: null,
  departureScheduled: null,
  departureScheduledTime: null,
  arrivalScheduledTime: null,
  operator: null,
  trainNumber: null,
  train: null,
  unitNumber: null,
  note: null,
  customFields: {},
};

const defaultPassenger = {
  guestName: null,
  seat: null,
  coach: null,
  seatNumber: null,
  seatClass: null,
  journeyReason: null,
};

const saveApiJourneySchema = journeySchema
  .merge(
    z.object({
      from: z.string(),
      to: z.string(),
    }),
  )
  .merge(
    z.object({
      train: trainSchema.shape.code,
    }),
  )
  .merge(
    z.object({
      operator: operatorSchema.shape.code,
    }),
  )
  .superRefine(validateJourneyDepartureDate);

const dateTimeSchema = z.string().datetime({ offset: true });

/** The station code, UIC code or ViaggiaTreno id of a station. */
const resolveStation = async (input: string) => {
  return (
    (await getStationByCode(input)) ??
    (await getStationByUic(input)) ??
    (await getStationByViaggiatrenoId(input))
  );
};

export const POST = legacyApiRoute(async ({ principal, event }) => {
  const body = await event.request.json();
  const filled = {
    ...defaultJourney,
    ...body,
    passengers: Array.isArray(body.passengers ?? body.seats)
      ? (body.passengers ?? body.seats).map((s: unknown) => ({
          ...defaultPassenger,
          ...(s && typeof s === 'object' ? s : {}),
        }))
      : [],
  };
  const legacyJourneyReason =
    typeof body.journeyReason === 'string' ? body.journeyReason : null;
  if (legacyJourneyReason) {
    filled.passengers = filled.passengers.map(
      (passenger: Record<string, unknown>) => ({
        ...passenger,
        journeyReason: passenger.journeyReason ?? legacyJourneyReason,
      }),
    );
  }
  const journey = {
    ...filled,
    departure: dateTimeSchema.safeParse(filled.departure).success
      ? filled.departure
      : filled.departure
        ? filled.departure + 'T10:00:00.000+00:00'
        : null,
    arrival: dateTimeSchema.safeParse(filled.arrival).success
      ? filled.arrival
      : filled.arrival
        ? filled.arrival + 'T10:00:00.000+00:00'
        : null,
  };

  const parsed = saveApiJourneySchema.safeParse(journey);
  if (!parsed.success) {
    return json(
      { success: false, errors: parsed.error.issues },
      { status: 400 },
    );
  }

  const from = await resolveStation(parsed.data.from);
  if (!from) {
    return apiError('Invalid departure station');
  }

  const to = await resolveStation(parsed.data.to);
  if (!to) {
    return apiError('Invalid arrival station');
  }

  let train;
  if (parsed.data.train) {
    train = await getTrainByCode(parsed.data.train);
    if (!train) {
      return apiError('Invalid train');
    }
  }

  let operator;
  if (parsed.data.operator) {
    operator = await getOperatorByCode(parsed.data.operator);
    if (!operator) {
      return apiError('Invalid operator');
    }
  }

  const data = {
    ...parsed.data,
    from,
    to,
    train: train ?? null,
    operator: operator ?? null,
  };

  if (data.passengers[0]?.userId === '<USER_ID>') {
    data.passengers[0].userId = principal.user.id;
  }

  const prepared = journeyValuesFromForm(data);
  if (!('values' in prepared)) {
    return apiError(prepared.message, 400);
  }

  const existingId = parsed.data.id ?? null;
  const id = await saveJourneyAggregate(apiJourneyWriter(principal), {
    id: existingId,
    ...prepared,
  });
  return json({ success: true, ...(existingId === null ? { id } : {}) });
});
