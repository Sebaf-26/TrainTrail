import {
  effectivePermissions,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import { API_OPERATIONS, type ApiOperationId } from '$lib/api/v1/operations';
import {
  authorizationAllowsScope,
  journeyScope,
  type ApiScope,
  type JourneyScopeOwnership,
} from '$lib/api/v1/scopes';
import type { DatabaseConnection } from '$lib/db/types';
import {
  canAccessResolvedOwnership,
  journeyOwnership,
} from '$lib/server/authorization/journey';
import type { JourneyWriter } from '$lib/server/utils/journey';
import { ApiOperationError } from './errors';
import { principalHasScope, type ApiPrincipal } from './principal';

export const requireApiScope = (principal: ApiPrincipal, scope: ApiScope) => {
  if (!principalHasScope(principal, scope)) {
    throw new ApiOperationError(
      'insufficient_scope',
      `The credential requires ${scope}`,
    );
  }
  if (!authorizationAllowsScope(principal.authorization, scope)) {
    throw new ApiOperationError(
      'forbidden',
      'The current role does not permit this action',
    );
  }
};

/** The scopes every call to `operation` needs, from the operation registry. */
export const requireOperation = (
  principal: ApiPrincipal,
  operation: ApiOperationId,
) => {
  for (const scope of API_OPERATIONS[operation].requires)
    requireApiScope(principal, scope);
};

/*
 * "May this credential act on this journey": resolve ownership from
 * participation once, then apply the role check and the matching
 * `journey.<action>.<own|any>` scope. A role denial is masked as `not_found`.
 */
export const requireJourneyScope = async (
  principal: ApiPrincipal,
  action: 'read' | 'update' | 'delete',
  journeyId: number,
  connection?: DatabaseConnection,
): Promise<JourneyScopeOwnership> => {
  const ownership = await journeyOwnership(
    principal.user.id,
    journeyId,
    connection,
  );
  if (!canAccessResolvedOwnership(principal.authorization, action, ownership)) {
    throw new ApiOperationError('not_found', 'Journey not found');
  }
  requireApiScope(principal, journeyScope(action, ownership));
  return ownership;
};

export const apiJourneyWriter = (principal: ApiPrincipal): JourneyWriter => ({
  authorization: principal.authorization,
  requireScope: (scope) => requireApiScope(principal, scope),
});

export const effectiveApiPermissions = (
  principal: Pick<ApiPrincipal, 'authorization'>,
) =>
  principal.authorization.isOwner
    ? [...PERMISSIONS]
    : [...effectivePermissions(principal.authorization.permissions)];
