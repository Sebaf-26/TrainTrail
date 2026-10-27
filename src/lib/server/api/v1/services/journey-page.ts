import { db } from '$lib/db';
import { listJourneyBaseQuery } from '$lib/db/queries';
import type { Journey } from '$lib/db/types';
import type { ResolvedJourneyScope } from '$lib/journey-scope';
import type { JourneyTrackSummary } from '$lib/api/v1/dto';

export type DecodedCursor = { date: string; id: number };

/** A page request whose cursor has already been decoded and trusted. */
export type JourneyPage = { limit: number; cursor: DecodedCursor | null };

export const encodeCursor = (journey: Pick<Journey, 'date' | 'id'>) =>
  Buffer.from(JSON.stringify({ date: journey.date, id: journey.id })).toString(
    'base64url',
  );

export const decodeCursor = (value: string): DecodedCursor | null => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const date: unknown = Reflect.get(parsed, 'date');
    const id: unknown = Reflect.get(parsed, 'id');
    return typeof date === 'string' && Number.isSafeInteger(id)
      ? { date, id: Number(id) }
      : null;
  } catch {
    return null;
  }
};

export const listJourneysPage = async (
  scope: ResolvedJourneyScope,
  page: JourneyPage,
) => {
  let query = listJourneyBaseQuery(
    db,
    scope.scope === 'user' ? scope.userId : undefined,
  )
    .orderBy('journey.date', 'desc')
    .orderBy('journey.id', 'desc');

  const cursor = page.cursor;
  if (cursor) {
    query = query.where((eb) =>
      eb.or([
        eb('journey.date', '<', cursor.date),
        eb.and([
          eb('journey.date', '=', cursor.date),
          eb('journey.id', '<', cursor.id),
        ]),
      ]),
    );
  }

  const rows = await query.limit(page.limit + 1).execute();
  const hasNextPage = rows.length > page.limit;
  const journeys = (
    hasNextPage ? rows.slice(0, page.limit) : rows
  ) as Journey[];
  const nextCursor = hasNextPage
    ? encodeCursor(journeys[journeys.length - 1]!)
    : null;

  const summaries = journeys.length
    ? await db
        .selectFrom('journeyTrack')
        .select([
          'journeyId',
          'pointCount',
          'updatedAt',
          'sourceFormat',
          'sourceName',
        ])
        .where(
          'journeyId',
          'in',
          journeys.map((journey) => journey.id),
        )
        .execute()
    : [];
  const tracks = new Map<number, JourneyTrackSummary>(
    summaries.map((summary) => [
      summary.journeyId,
      {
        pointCount: summary.pointCount,
        updatedAt: summary.updatedAt.toISOString(),
        sourceFormat: summary.sourceFormat,
        sourceName: summary.sourceName,
      },
    ]),
  );

  return { journeys, tracks, nextCursor };
};

/** The same track summary shape the list endpoint embeds, for a single journey. */
export const getJourneyTrackSummary = async (
  journeyId: number,
): Promise<JourneyTrackSummary | null> => {
  const row = await db
    .selectFrom('journeyTrack')
    .select(['pointCount', 'updatedAt', 'sourceFormat', 'sourceName'])
    .where('journeyId', '=', journeyId)
    .executeTakeFirst();
  return row
    ? {
        pointCount: row.pointCount,
        updatedAt: row.updatedAt.toISOString(),
        sourceFormat: row.sourceFormat,
        sourceName: row.sourceName,
      }
    : null;
};
