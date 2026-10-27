import type { CreateJourney, Journey } from '$lib/db/types';
import type { AuthorizationContext } from '$lib/server/authorization/context';
import { hasPermission } from '$lib/server/authorization/authorize';

export type JourneyImportMode = 'personal' | 'restore';

export type MissingJourneyReferenceUpdate = {
  operatorId?: number;
  trainId?: number;
};

export const getMissingJourneyReferenceUpdate = (
  existing: Pick<Journey, 'operator' | 'train'>,
  incoming: Pick<CreateJourney, 'operator' | 'train'>,
): MissingJourneyReferenceUpdate | null => {
  const update: MissingJourneyReferenceUpdate = {};

  if (!existing.operator && incoming.operator?.id != null) {
    update.operatorId = incoming.operator.id;
  }
  if (!existing.train && incoming.train?.id != null) {
    update.trainId = incoming.train.id;
  }

  return Object.keys(update).length ? update : null;
};

type JourneyImportPassenger = Pick<
  CreateJourney['passengers'][number],
  'userId' | 'guestName' | 'seat' | 'coach' | 'seatNumber' | 'seatClass'
>;

const journeyImportPassengerKey = (passenger: JourneyImportPassenger) =>
  passenger.userId
    ? JSON.stringify(['user', passenger.userId])
    : JSON.stringify([
        'guest',
        passenger.guestName,
        passenger.seat,
        passenger.coach,
        passenger.seatNumber,
        passenger.seatClass,
      ]);

export const getMissingImportPassengers = <
  Passenger extends JourneyImportPassenger,
>(
  existingPassengers: readonly JourneyImportPassenger[],
  incomingPassengers: readonly Passenger[],
): Passenger[] => {
  const remainingExisting = new Map<string, number>();
  for (const passenger of existingPassengers) {
    const key = journeyImportPassengerKey(passenger);
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  }

  const seenIncomingUsers = new Set<string>();
  const missingPassengers: Passenger[] = [];
  for (const passenger of incomingPassengers) {
    const key = journeyImportPassengerKey(passenger);

    if (passenger.userId) {
      if (seenIncomingUsers.has(key)) continue;
      seenIncomingUsers.add(key);
    }

    const remaining = remainingExisting.get(key) ?? 0;
    if (remaining > 0) {
      remainingExisting.set(key, remaining - 1);
      continue;
    }

    missingPassengers.push(passenger);
  }

  return missingPassengers;
};

export const validateJourneyImportPermissions = (
  authorization: AuthorizationContext,
  journeys: CreateJourney[],
  mode: JourneyImportMode,
): string | null => {
  if (mode === 'restore') {
    return hasPermission(authorization, 'journey.import.any')
      ? null
      : 'You cannot restore journeys for other users';
  }

  if (!hasPermission(authorization, 'journey.import.own')) {
    return 'You cannot import journeys';
  }

  for (const [index, journey] of journeys.entries()) {
    if (
      journey.passengers.some(
        (passenger) =>
          passenger.userId != null && passenger.userId !== authorization.userId,
      )
    ) {
      return `Journey ${index + 1} assigns another user as a passenger`;
    }

    if (
      !journey.passengers.some(
        (passenger) => passenger.userId === authorization.userId,
      )
    ) {
      return `Journey ${index + 1} must include the importing user`;
    }
  }

  return null;
};
