import { db } from '@test/db';

/**
 * Return the most recent journey on (fromId → toId) seated to `userId`. The
 * user filter is essential: tests run in parallel and all reuse the same
 * `getOrCreate` stations, so a route-only lookup races against other workers'
 * journeys and returns whichever happened to commit last.
 */
export const latestJourneyFor = (
  userId: string,
  fromId: number,
  toId: number,
) =>
  db
    .selectFrom('journey')
    .innerJoin('journeyPassenger', 'journeyPassenger.journeyId', 'journey.id')
    .select([
      'journey.id',
      'date',
      'departure',
      'arrival',
      'datePrecision',
      'duration',
    ])
    .where('journeyPassenger.userId', '=', userId)
    .where('journey.fromId', '=', fromId)
    .where('journey.toId', '=', toId)
    .orderBy('journey.id', 'desc')
    .executeTakeFirstOrThrow();

/**
 * Normalize a DB-returned ISO string to canonical `…Z` form. Postgres/Kysely
 * may serialize UTC instants with `+00:00` instead of `Z`; both are valid
 * ISO-8601 but `toBe()` does string equality, so tests assert on the canonical
 * form returned by `new Date(...).toISOString()`.
 */
export const isoInstant = (s: string | null): string | null =>
  s ? new Date(s).toISOString() : null;
