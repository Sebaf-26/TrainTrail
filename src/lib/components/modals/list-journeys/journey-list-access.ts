import {
  hasClientPermission,
  type Permission,
} from '$lib/authorization/permissions';

type ClientAuthorization = {
  isOwner: boolean;
  permissions: Permission[];
} | null;

type JourneyWithPassengers = {
  passengers: readonly { userId: string | null }[];
};

export const createJourneyListAccess = ({
  authorization,
  userId,
  readonly,
}: {
  authorization: ClientAuthorization;
  userId: string | null;
  readonly: boolean;
}) => {
  const has = (permission: Permission) =>
    !readonly && hasClientPermission(authorization, permission);
  const canUpdateAny = has('journey.update.any');
  const canUpdateOwn = has('journey.update.own');
  const canDeleteAny = has('journey.delete.any');
  const canDeleteOwn = has('journey.delete.own');
  const isOwnJourney = (journey: JourneyWithPassengers) =>
    Boolean(
      userId &&
      journey.passengers.some((passenger) => passenger.userId === userId),
    );
  const canUpdateJourney = (journey: JourneyWithPassengers) =>
    canUpdateAny || (canUpdateOwn && isOwnJourney(journey));
  const canDeleteJourney = (journey: JourneyWithPassengers) =>
    canDeleteAny || (canDeleteOwn && isOwnJourney(journey));

  return {
    canCreateJourney: has('journey.create.own'),
    canUpdateJourney,
    canDeleteJourney,
    canBulkDelete: (journeys: readonly JourneyWithPassengers[]) =>
      journeys.length > 0 && journeys.every(canDeleteJourney),
  };
};
