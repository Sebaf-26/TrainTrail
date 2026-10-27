import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  DEFAULT_JOURNEY_SCOPE,
  journeyScopeSchema,
  resolveJourneyScope,
} from '$lib/journey-scope';
import { authedProcedure, router } from '$lib/server/trpc';
import { reduceJourneyTrackForMap } from '$lib/track/render';
import {
  journeyTrackPayloadSchema,
  type JourneyTrackRow,
  type JourneyTrackSourceFormat,
} from '$lib/track/schema';
import {
  canAccessJourney,
  canListJourneys,
} from '$lib/server/authorization/journey';

const parseTrackRow = (
  row: {
    journeyId: number;
    track: unknown;
    sourceFormat: JourneyTrackSourceFormat;
    sourceName: string | null;
    pointCount: number;
  },
  reduceForMap = false,
): JourneyTrackRow => {
  const track = journeyTrackPayloadSchema.parse(row.track);
  return {
    journeyId: row.journeyId,
    ...(reduceForMap ? reduceJourneyTrackForMap(track) : track),
    sourceFormat: row.sourceFormat,
    sourceName: row.sourceName,
    pointCount: row.pointCount,
  };
};

export const journeyTrackRouter = router({
  list: authedProcedure
    .input(journeyScopeSchema.optional().default(DEFAULT_JOURNEY_SCOPE))
    .query(async ({ ctx: { user, authorization }, input }) => {
      if (!canListJourneys(authorization, input)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const scope = resolveJourneyScope(input, user.id);

      let query = db
        .selectFrom('journeyTrack')
        .innerJoin('journey', 'journey.id', 'journeyTrack.journeyId')
        .select([
          'journeyTrack.journeyId',
          'journeyTrack.track',
          'journeyTrack.sourceFormat',
          'journeyTrack.sourceName',
          'journeyTrack.pointCount',
        ]);

      if (scope.scope === 'user') {
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom('journeyPassenger')
              .select('journeyPassenger.id')
              .whereRef('journeyPassenger.journeyId', '=', 'journey.id')
              .where('journeyPassenger.userId', '=', scope.userId),
          ),
        );
      }

      const rows = await query.execute();
      return rows.map((row) => parseTrackRow(row, true));
    }),
  get: authedProcedure
    .input(z.number())
    .query(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessJourney(authorization, 'read', input))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const row = await db
        .selectFrom('journeyTrack')
        .select([
          'journeyTrack.journeyId',
          'journeyTrack.track',
          'journeyTrack.sourceFormat',
          'journeyTrack.sourceName',
          'journeyTrack.pointCount',
        ])
        .where('journeyId', '=', input)
        .executeTakeFirst();

      return row ? parseTrackRow(row) : null;
    }),
});
