import type { z } from 'zod';

import { toJourneyDto } from '$lib/api/v1/dto';
import type { journeyInputSchema } from '$lib/api/v1/schemas';
import { journeyScope, journeyScopeOwnership } from '$lib/api/v1/scopes';
import { db } from '$lib/db';
import type { CreateJourney, DatabaseConnection } from '$lib/db/types';
import { resolveJourneyScope, type JourneyScope } from '$lib/journey-scope';
import { generateBackup } from '$lib/server/utils/backup';
import {
  getJourney as loadJourney,
  listJourneysInScope,
  saveJourneyAggregate,
} from '$lib/server/utils/journey';
import { computeCompletedJourneyStatsSummary } from '$lib/stats/summary';
import {
  apiJourneyWriter,
  requireApiScope,
  requireJourneyScope,
} from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';
import {
  getJourneyTrackSummary,
  listJourneysPage,
  type JourneyPage,
} from './journey-page';

type JourneyInput = z.infer<typeof journeyInputSchema>;

/*
 * Which journeys a list, export or stats call may see: the credential needs
 * `journey.<action>.<own|any>` for the resolved ownership, which the role must
 * also permit.
 */
export const visibleJourneyScope = (
  principal: ApiPrincipal,
  scope: JourneyScope,
  action: 'read' | 'export',
) => {
  requireApiScope(
    principal,
    journeyScope(action, journeyScopeOwnership(scope, principal.user.id)),
  );
  return resolveJourneyScope(scope, principal.user.id);
};

export const getJourneyStats = async (
  principal: ApiPrincipal,
  scope: JourneyScope,
) =>
  computeCompletedJourneyStatsSummary(
    await listJourneysInScope(visibleJourneyScope(principal, scope, 'read')),
  );

export const listJourneys = async (
  principal: ApiPrincipal,
  scope: JourneyScope,
  page: JourneyPage,
) => {
  const result = await listJourneysPage(
    visibleJourneyScope(principal, scope, 'read'),
    page,
  );
  return {
    data: result.journeys.map((journey) =>
      toJourneyDto(journey, result.tracks.get(journey.id) ?? null),
    ),
    page: { nextCursor: result.nextCursor },
  };
};

export const exportJourneys = async (
  principal: ApiPrincipal,
  scope: JourneyScope,
) => generateBackup(visibleJourneyScope(principal, scope, 'export'));

const journeyDto = async (id: number) => {
  const journey = await loadJourney(id);
  if (!journey) throw new ApiOperationError('not_found', 'Journey not found');
  return toJourneyDto(journey, await getJourneyTrackSummary(id));
};

export const getJourney = async (principal: ApiPrincipal, id: number) => {
  await requireJourneyScope(principal, 'read', id);
  return journeyDto(id);
};

const resolveReferences = async (
  connection: DatabaseConnection,
  input: JourneyInput,
): Promise<CreateJourney> => {
  const from = await connection
    .selectFrom('station')
    .selectAll()
    .where('id', '=', input.fromId)
    .executeTakeFirst();
  const to = await connection
    .selectFrom('station')
    .selectAll()
    .where('id', '=', input.toId)
    .executeTakeFirst();
  const train = input.trainId
    ? await connection
        .selectFrom('train')
        .selectAll()
        .where('id', '=', input.trainId)
        .executeTakeFirst()
    : null;
  const operator = input.operatorId
    ? await connection
        .selectFrom('operator')
        .selectAll()
        .where('id', '=', input.operatorId)
        .executeTakeFirst()
    : null;
  if (!from || !to)
    throw new ApiOperationError(
      'validation_failed',
      'Departure and arrival stations must exist',
    );
  if (input.trainId && !train)
    throw new ApiOperationError('validation_failed', 'Train does not exist');
  if (input.operatorId && !operator)
    throw new ApiOperationError('validation_failed', 'Operator does not exist');
  const {
    fromId: _fromId,
    toId: _toId,
    trainId: _trainId,
    operatorId: _operatorId,
    customFields: _customFields,
    ...rest
  } = input;
  return {
    ...rest,
    from,
    to,
    train: train ?? null,
    operator: operator ?? null,
  };
};

const saveJourney = async (
  principal: ApiPrincipal,
  id: number | null,
  input: JourneyInput,
) =>
  saveJourneyAggregate(apiJourneyWriter(principal), {
    id,
    values: await resolveReferences(db, input),
    customFields: input.customFields,
  });

export const createJourney = (principal: ApiPrincipal, input: JourneyInput) =>
  saveJourney(principal, null, input);

/** Returns the updated journey. */
export const updateJourney = async (
  principal: ApiPrincipal,
  id: number,
  input: JourneyInput,
) => journeyDto(await saveJourney(principal, id, input));

export const deleteJourney = async (principal: ApiPrincipal, id: number) => {
  await requireJourneyScope(principal, 'delete', id);
  const deleted = await db
    .deleteFrom('journey')
    .where('id', '=', id)
    .executeTakeFirst();
  if (deleted.numDeletedRows !== 1n)
    throw new ApiOperationError('not_found', 'Journey not found');
};
