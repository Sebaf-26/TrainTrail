import { z } from 'zod';

import { page } from '$app/state';
import {
  JourneyDatePrecisions,
  type Operator,
  type Station,
  type CreateJourney,
} from '$lib/db/types';
import type { PlatformOptions } from '$lib/import/model';
import { journeyTrackInputSchema } from '$lib/track/schema';
import { api } from '$lib/trpc';
import { getTrainByCode, getTrainByName } from '$lib/utils/data/train';
import {
  getOperatorByCode,
  getOperatorByName,
} from '$lib/utils/data/operators';
import { getStationByCode } from '$lib/utils/data/stations/cache';
import { trainSchema } from '$lib/zod/train';
import { operatorSchema } from '$lib/zod/operator';
import { journeyStationSchema } from '$lib/zod/station';
import {
  journeyOptionalInformationSchema,
  journeyPassengerInformationSchema,
} from '$lib/zod/journey';
import { usernameSchema } from '$lib/zod/user';

const dateTimePrimitive = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();
const stationRefSchema = z.union([
  journeyStationSchema.omit({ id: true }),
  z.object({ code: z.string().min(1) }),
]);
const operatorRefSchema = operatorSchema.omit({ id: true }).nullable();
const trainRefSchema = trainSchema.omit({ id: true }).nullable();

// Custom-field values in TrainTrail backups are reference-only. Journey values
// are omitted here, and passenger values are discarded during user mapping.
const trainTrailJourneySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    datePrecision: z.enum(JourneyDatePrecisions).default('day'),
    from: stationRefSchema,
    to: stationRefSchema,
    departure: z
      .string()
      .datetime({ offset: true, message: 'Invalid datetime' })
      .nullable(),
    arrival: z
      .string()
      .datetime({ offset: true, message: 'Invalid datetime' })
      .nullable(),
    departureScheduled: dateTimePrimitive,
    arrivalScheduled: dateTimePrimitive,
    duration: z.number().int().positive().nullable(),
    operator: operatorRefSchema,
    train: trainRefSchema,
    track: journeyTrackInputSchema.nullable().optional(),
  })
  .merge(journeyOptionalInformationSchema.omit({ operator: true, train: true }))
  .merge(journeyPassengerInformationSchema);

const TrainTrailFile = z.object({
  journeys: trainTrailJourneySchema
    .array()
    .min(1, 'At least one journey is required'),
  users: z
    .object({
      id: z.string().min(3),
      username: usernameSchema,
      displayName: z.string().min(3),
    })
    .array()
    .min(1, 'At least one user is required'),
});

type StationRef = z.infer<typeof stationRefSchema>;
type OperatorRef = z.infer<typeof operatorRefSchema>;
type TrainRef = z.infer<typeof trainRefSchema>;

const getStationCode = (station: StationRef) => station.code;

const getOperatorCode = (operator: OperatorRef) => operator?.code ?? null;

const getTrainCode = (train: TrainRef) => train?.code ?? null;

const getOperatorName = (operator: OperatorRef) => operator?.name ?? null;

const getTrainName = (train: TrainRef) => train?.name ?? null;

const resolveStation = async (
  station: StationRef,
  stationMapping?: Record<string, Station>,
) => {
  const code = getStationCode(station);
  return stationMapping?.[code] ?? (await getStationByCode(code));
};

const resolveOperator = async (
  operator: OperatorRef,
  operatorMapping?: Record<string, Operator>,
) => {
  if (!operator) return null;

  const code = getOperatorCode(operator);
  const name = getOperatorName(operator);
  if (code) {
    return operatorMapping?.[code] ?? (await getOperatorByCode(code));
  }
  if (name) {
    return await getOperatorByName(name);
  }

  return null;
};

const resolveTrain = async (train: TrainRef) => {
  if (!train) return null;

  const code = getTrainCode(train);
  const name = getTrainName(train);
  if (code) return await getTrainByCode(code);
  if (name) return await getTrainByName(name);

  return null;
};

export const processTrainTrailFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const user = page.data.user;
  if (!user) {
    throw new Error('User not found');
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (_) {
    throw new Error('Invalid JSON found in TrainTrail file');
  }

  const result = TrainTrailFile.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  const journeys: CreateJourney[] = [];
  const data = result.data;
  const dataUsers = data.users.reduce<
    Record<
      string,
      {
        id: string;
        username: string;
        displayName: string;
      }
    >
  >((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
  const localUsers =
    options.importMode === 'restore' ? await api.user.list.query() : [user];

  const getMappedUserId = (exportedUserId: string) => {
    const exportedUser = dataUsers[exportedUserId];
    if (!exportedUser) return null;

    const requestedUserId = options.userMapping?.[exportedUser.id];
    const requestedUser = requestedUserId
      ? localUsers.find((localUser) => localUser.id === requestedUserId)
      : null;
    if (options.userMapping) return requestedUser?.id ?? null;

    return (
      localUsers.find(
        (localUser) => localUser.username === exportedUser.username,
      )?.id ?? null
    );
  };

  const exportedUsers = data.users.map((exportedUser) => {
    const mappedUserId = getMappedUserId(exportedUser.id);

    return {
      id: exportedUser.id,
      username: exportedUser.username,
      displayName: exportedUser.displayName,
      mappedUserId,
    };
  });

  const unknownStations: Record<string, number[]> = {};
  const unknownOperators: Record<string, number[]> = {};
  const addUnknownJourneyIndex = (
    records: Record<string, number[]>,
    key: string,
    journeyIndex: number,
  ) => {
    const journeyIndexes = records[key] ?? [];
    records[key] = journeyIndexes;
    journeyIndexes.push(journeyIndex);
  };
  const rawJourneys =
    options.importMode === 'restore'
      ? data.journeys
      : data.journeys.filter((journey) =>
          journey.passengers.some(
            (passenger) =>
              passenger.userId != null &&
              getMappedUserId(passenger.userId) === user.id,
          ),
        );

  for (const rawJourney of rawJourneys) {
    const journeyIndex = journeys.length;

    const passengers = rawJourney.passengers.map((rawPassenger) => {
      const { customFields: _exportOnlyCustomFields, ...passenger } =
        rawPassenger;
      const dataUser = dataUsers?.[passenger.userId ?? ''];
      const mappedUserId = dataUser ? getMappedUserId(dataUser.id) : null;
      const user = mappedUserId
        ? localUsers.find((user) => user.id === mappedUserId)
        : null;

      /*
      1. If the user is known, no guest name is needed.
      2. If the user is unknown, but the guest name is known, use the guest name.
      3. If the user is unknown and the guest name is unknown, use the provided display name (this could happen if the user is not in the database).
       */
      const guestName = user
        ? null
        : passenger.guestName
          ? passenger.guestName
          : dataUser
            ? dataUser.displayName
            : null;

      return {
        ...passenger,
        userId: user?.id ?? null,
        guestName,
        customFields: {},
      };
    });

    const fromCode = getStationCode(rawJourney.from);
    const toCode = getStationCode(rawJourney.to);
    const operatorCode = getOperatorCode(rawJourney.operator);
    const from = await resolveStation(rawJourney.from, options.stationMapping);
    const to = await resolveStation(rawJourney.to, options.stationMapping);
    const operator = await resolveOperator(
      rawJourney.operator,
      options.operatorMapping,
    );
    const train = await resolveTrain(rawJourney.train);

    if (!from) {
      addUnknownJourneyIndex(unknownStations, fromCode, journeyIndex);
    }
    if (!to) {
      addUnknownJourneyIndex(unknownStations, toCode, journeyIndex);
    }
    if (!operator && operatorCode) {
      addUnknownJourneyIndex(unknownOperators, operatorCode, journeyIndex);
    }

    journeys.push({
      ...rawJourney,
      departureScheduled: rawJourney.departureScheduled ?? null,
      arrivalScheduled: rawJourney.arrivalScheduled ?? null,
      departurePlatform: rawJourney.departurePlatform ?? null,
      arrivalPlatform: rawJourney.arrivalPlatform ?? null,
      from: from || null,
      to: to || null,
      operator,
      train,
      track: rawJourney.track,
      passengers,
    });
  }

  return {
    journeys,
    unknowns: {
      stations: unknownStations,
      operators: unknownOperators,
      train: {},
    },
    exportedUsers,
  };
};
