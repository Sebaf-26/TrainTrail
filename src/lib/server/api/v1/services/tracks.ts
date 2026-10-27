import { db } from '$lib/db';
import {
  deleteJourneyTrackPrimitiveWithConnection,
  upsertJourneyTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import {
  journeyTrackPayloadSchema,
  type JourneyTrackInput,
} from '$lib/track/schema';
import { requireJourneyScope } from '../access';
import type { ApiPrincipal } from '../principal';

/*
 * Not re-checked against read scopes after a write: a credential holding
 * `tracks.write` without `tracks.read` must not get a 403 for an operation
 * that committed.
 */
const readTrack = async (journeyId: number) => {
  const row = await db
    .selectFrom('journeyTrack')
    .selectAll()
    .where('journeyId', '=', journeyId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    journeyId,
    ...journeyTrackPayloadSchema.parse(row.track),
    sourceFormat: row.sourceFormat,
    sourceName: row.sourceName,
    pointCount: row.pointCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

export const getJourneyTrack = async (
  principal: ApiPrincipal,
  journeyId: number,
) => {
  await requireJourneyScope(principal, 'read', journeyId);
  return readTrack(journeyId);
};

export const setJourneyTrack = async (
  principal: ApiPrincipal,
  journeyId: number,
  track: JourneyTrackInput,
) => {
  await requireJourneyScope(principal, 'update', journeyId);
  await upsertJourneyTrackPrimitiveWithConnection(db, journeyId, track);
  return readTrack(journeyId);
};

export const deleteJourneyTrack = async (
  principal: ApiPrincipal,
  journeyId: number,
) => {
  await requireJourneyScope(principal, 'update', journeyId);
  await deleteJourneyTrackPrimitiveWithConnection(db, journeyId);
};
