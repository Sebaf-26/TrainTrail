import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';
import { db } from '$lib/db';
import type { JourneyScope } from '$lib/journey-scope';
import { hasPermission } from './authorize';
import type { AuthorizationContext } from './context';

type JourneyOwnershipScope = 'own' | 'any';
export type JourneyAccessAction =
  'read' | 'update' | 'delete' | 'passengers.manage';

const JOURNEY_ACCESS_PERMISSIONS = {
  read: { own: 'journey.read.own', any: 'journey.read.any' },
  update: { own: 'journey.update.own', any: 'journey.update.any' },
  delete: { own: 'journey.delete.own', any: 'journey.delete.any' },
  'passengers.manage': {
    own: 'journey.passengers.manage.own',
    any: 'journey.passengers.manage.any',
  },
} as const;

const JOURNEY_CREATE_PERMISSIONS = {
  own: 'journey.create.own',
  any: 'journey.create.any',
} as const;

const JOURNEY_EXPORT_PERMISSIONS = {
  own: 'journey.export.own',
  any: 'journey.export.any',
} as const;

const ownershipScopeForList = (scope: JourneyScope): JourneyOwnershipScope =>
  scope.scope === 'mine' ? 'own' : 'any';

export const canListJourneys = (
  authorization: AuthorizationContext,
  scope: JourneyScope,
) =>
  hasPermission(
    authorization,
    JOURNEY_ACCESS_PERMISSIONS.read[ownershipScopeForList(scope)],
  );

export const canExportJourneys = (
  authorization: AuthorizationContext,
  scope: JourneyScope,
) =>
  hasPermission(
    authorization,
    JOURNEY_EXPORT_PERMISSIONS[ownershipScopeForList(scope)],
  );

export const canShareOwnJourneys = (authorization: AuthorizationContext) =>
  hasPermission(authorization, 'journey.read.own') &&
  hasPermission(authorization, 'journey.share.own');

export const canCreateJourney = (
  authorization: AuthorizationContext,
  passengers: readonly { userId: string | null }[],
) => {
  const includesActor = passengers.some(
    (passenger) => passenger.userId === authorization.userId,
  );
  const scope: JourneyOwnershipScope = includesActor ? 'own' : 'any';

  if (!hasPermission(authorization, JOURNEY_CREATE_PERMISSIONS[scope])) {
    return false;
  }

  return (
    passengers.length <= 1 ||
    hasPermission(
      authorization,
      JOURNEY_ACCESS_PERMISSIONS['passengers.manage'][scope],
    )
  );
};

export const isJourneyParticipant = async (
  userId: string,
  journeyId: number,
  connection: Kysely<DB> = db,
) =>
  Boolean(
    await connection
      .selectFrom('journeyPassenger')
      .select('id')
      .where('journeyId', '=', journeyId)
      .where('userId', '=', userId)
      .executeTakeFirst(),
  );

/** The ownership scope a caller holds for one journey, from participation. */
export const journeyOwnership = async (
  userId: string,
  journeyId: number,
  connection: Kysely<DB> = db,
): Promise<JourneyOwnershipScope> =>
  (await isJourneyParticipant(userId, journeyId, connection)) ? 'own' : 'any';

export const canAccessJourney = async (
  authorization: AuthorizationContext,
  action: JourneyAccessAction,
  journeyId: number,
  connection: Kysely<DB> = db,
) => {
  const permissions = JOURNEY_ACCESS_PERMISSIONS[action];
  if (hasPermission(authorization, permissions.any)) return true;
  if (!hasPermission(authorization, permissions.own)) return false;

  return isJourneyParticipant(authorization.userId, journeyId, connection);
};

/*
 * The same role check as `canAccessJourney`, for callers that already resolved
 * participation. Lets a caller look up participation once and derive both the
 * role decision and the ownership scope from it, instead of paying for a second
 * `journey_participant` query.
 */
export const canAccessResolvedOwnership = (
  authorization: AuthorizationContext,
  action: JourneyAccessAction,
  ownership: JourneyOwnershipScope,
) => {
  const permissions = JOURNEY_ACCESS_PERMISSIONS[action];
  if (hasPermission(authorization, permissions.any)) return true;
  return ownership === 'own' && hasPermission(authorization, permissions.own);
};

export const canAccessJourneys = async (
  authorization: AuthorizationContext,
  action: JourneyAccessAction,
  journeyIds: readonly number[],
  connection: Kysely<DB> = db,
) => {
  const ids = [...new Set(journeyIds)];
  if (ids.length === 0) return true;

  const permissions = JOURNEY_ACCESS_PERMISSIONS[action];
  if (hasPermission(authorization, permissions.any)) return true;
  if (!hasPermission(authorization, permissions.own)) return false;

  const participatingJourneys = await connection
    .selectFrom('journeyPassenger')
    .select('journeyId')
    .distinct()
    .where('userId', '=', authorization.userId)
    .where('journeyId', 'in', ids)
    .execute();
  return participatingJourneys.length === ids.length;
};
