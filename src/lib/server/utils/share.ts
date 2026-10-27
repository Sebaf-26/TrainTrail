import { TRPCError } from '@trpc/server';
import type { Insertable } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import { canShareOwnJourneys } from '$lib/server/authorization/journey';
import { loadAuthorizationContext } from '$lib/server/authorization/context';
import { listJourneyBaseQuery } from '$lib/db/queries';
import type { public_share } from '$lib/db/schema';
import type {
  Station,
  Train,
  Operator,
  JourneyDatePrecision,
  JourneyPassenger,
  PublicShare,
} from '$lib/db/types';
import { generateRandomString } from '$lib/server/utils/random';
import { reduceJourneyTrackForMap } from '$lib/track/render';
import {
  journeyTrackPayloadSchema,
  toJourneyTrackInput,
  type JourneyTrackInput,
} from '$lib/track/schema';
import type { ErrorActionResult } from '$lib/utils/forms';
import { baseShareSchema, type shareSchema } from '$lib/zod/share';

// Use complete objects instead of individual field properties
interface SanitizedJourney {
  id: number;
  from: Station;
  to: Station;
  duration: number | null;
  journeyReason: string | null;
  unitNumber: string | null;
  passengers: JourneyPassenger[];
  // Conditionally included fields based on privacy settings
  trainNumber?: string | null;
  operator?: Operator | null;
  train?: Train | null;
  departure?: string | null;
  arrival?: string | null;
  departureScheduled?: string | null;
  arrivalScheduled?: string | null;
  date?: string | null;
  datePrecision?: JourneyDatePrecision;
  track?: JourneyTrackInput;
}

// Zod schemas for input validation
export const shareCreateSchema = z
  .object({
    slug: z.string().optional(),
    expiresAt: z.date().optional(),
  })
  .merge(baseShareSchema);

export const shareUpdateSchema = z.object({
  id: z.number(),
  slug: z.string().optional(),
  expiresAt: z.date().optional(),
  showMap: z.boolean().optional(),
  showStats: z.boolean().optional(),
  showJourneyList: z.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  showTrainNumbers: z.boolean().optional(),
  showOperators: z.boolean().optional(),
  showTrain: z.boolean().optional(),
  showTimes: z.boolean().optional(),
  showTracks: z.boolean().optional(),
  showDates: z.boolean().optional(),
  showSeat: z.boolean().optional(),
});

export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type ShareUpdateInput = z.infer<typeof shareUpdateSchema>;

/**
 * Delete all expired shares from the database (global cleanup)
 */
export async function deleteExpiredShares() {
  const result = await db
    .deleteFrom('publicShare')
    .where('expiresAt', '<', new Date())
    .where('expiresAt', 'is not', null)
    .execute();

  return result.reduce((total, r) => total + Number(r.numDeletedRows), 0);
}

/**
 * List all shares for a user, removing expired ones
 */
export async function listUserShares(userId: string) {
  // Delete expired shares first
  await deleteExpiredShares();

  // Return active shares
  return await db
    .selectFrom('publicShare')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('createdAt', 'desc')
    .execute();
}

type ShareValues = Omit<
  Insertable<public_share>,
  'id' | 'userId' | 'createdAt'
>;

export class ShareSlugTakenError extends Error {
  constructor() {
    super('Share URL already exists. Please choose a different one.');
    this.name = 'ShareSlugTakenError';
  }
}

const assertSlugAvailable = async (slug: string, exceptId?: number) => {
  let query = db
    .selectFrom('publicShare')
    .select('id')
    .where('slug', '=', slug);
  if (exceptId !== undefined) query = query.where('id', '!=', exceptId);
  if (await query.executeTakeFirst()) throw new ShareSlugTakenError();
};

/** Tracks are drawn on the map, so they cannot be shown without it. */
const withTrackInvariant = <T extends Partial<ShareValues>>(
  values: T,
  showMap: boolean | undefined,
): T => (showMap === false ? { ...values, showTracks: false } : values);

/** Inserts a share, generating a slug when none is given. */
export const insertShare = async (
  userId: string,
  values: Omit<ShareValues, 'slug'> & { slug?: string | null },
) => {
  const slug = values.slug || generateRandomString(12);
  await assertSlugAvailable(slug);
  return db
    .insertInto('publicShare')
    .values({
      ...withTrackInvariant(values, values.showMap ?? true),
      slug,
      userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
};

/** Applies `patch` to one of the user's shares; undefined when it is not theirs. */
export const patchShare = async (
  userId: string,
  id: number,
  patch: Partial<ShareValues>,
) => {
  const current = await db
    .selectFrom('publicShare')
    .select('showMap')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!current) return undefined;
  if (patch.slug) await assertSlugAvailable(patch.slug, id);
  return db
    .updateTable('publicShare')
    .set(withTrackInvariant(patch, patch.showMap ?? current.showMap))
    .where('id', '=', id)
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirst();
};

const conflictAsTrpc = async <T>(write: Promise<T>) => {
  try {
    return await write;
  } catch (error) {
    if (error instanceof ShareSlugTakenError)
      throw new TRPCError({ code: 'CONFLICT', message: error.message });
    throw error;
  }
};

/**
 * Create a new share
 */
export async function createShare(userId: string, input: ShareCreateInput) {
  return conflictAsTrpc(
    insertShare(userId, {
      ...input,
      expiresAt: input.expiresAt ?? null,
      dateFrom: input.dateFrom || null,
      dateTo: input.dateTo || null,
    }),
  );
}

/**
 * Update an existing share
 */
export async function updateShare(userId: string, input: ShareUpdateInput) {
  const { id, ...updates } = input;
  const updated = await conflictAsTrpc(patchShare(userId, id, updates));
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
  return updated;
}

/**
 * Delete a share
 */
export async function deleteShare(userId: string, shareId: number) {
  const result = await db
    .deleteFrom('publicShare')
    .where('id', '=', shareId)
    .where('userId', '=', userId)
    .executeTakeFirst();

  return result.numDeletedRows > 0;
}

/**
 * Get public share data for viewing
 */
export async function getPublicShareData(slug: string) {
  const share = await db
    .selectFrom('publicShare')
    .selectAll()
    .where('slug', '=', slug)
    .where((eb) =>
      eb.or([eb('expiresAt', 'is', null), eb('expiresAt', '>', new Date())]),
    )
    .executeTakeFirst();

  if (!share) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Share not found or expired',
    });
  }

  const authorization = await loadAuthorizationContext(share.userId);
  if (!authorization || !canShareOwnJourneys(authorization)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Share not found or expired',
    });
  }

  // Get user's journeys with filtering
  const journeys = await getFilteredJourneysForShare(share);

  // Sanitize journey data based on privacy settings
  const sanitizedJourneys = sanitizeJourneyData(journeys, share);
  const journeyIds = sanitizedJourneys.map((journey) => journey.id);
  const showTracks = share.showMap && share.showTracks;
  const trackRows =
    showTracks && journeyIds.length > 0
      ? await db
          .selectFrom('journeyTrack')
          .select(['journeyId', 'track', 'sourceFormat', 'sourceName'])
          .where('journeyId', 'in', journeyIds)
          .execute()
      : [];
  const tracksByJourney = new Map<number, JourneyTrackInput>(
    trackRows.map((row) => {
      const track = journeyTrackPayloadSchema.parse(row.track);
      const renderTrack = reduceJourneyTrackForMap(track);
      return [
        row.journeyId,
        toJourneyTrackInput(
          {
            ...renderTrack,
            sourceFormat: row.sourceFormat,
            sourceName: row.sourceName,
          },
          { includeTimes: share.showTimes },
        ),
      ];
    }),
  );

  return {
    settings: {
      showMap: share.showMap,
      showStats: share.showStats,
      showJourneyList: share.showJourneyList,
      showTracks,
    },
    journeys: sanitizedJourneys.map((journey) => ({
      ...journey,
      ...(tracksByJourney.has(journey.id)
        ? { track: tracksByJourney.get(journey.id) }
        : {}),
    })),
  };
}

/**
 * Get journeys for a share with date filtering
 * Reuses the complete listJourneyBaseQuery instead of sparse field selection
 */
async function getFilteredJourneysForShare(share: PublicShare) {
  let query = listJourneyBaseQuery(db, share.userId);

  // Apply date filtering if specified
  if (share.dateFrom) {
    query = query.where('journey.date', '>=', share.dateFrom);
  }
  if (share.dateTo) {
    query = query.where('journey.date', '<=', share.dateTo);
  }

  return await query.execute();
}

/**
 * Sanitize journey data based on privacy settings
 * Sends complete objects to frontend instead of individual field properties
 */
export function sanitizeJourneyData(
  journeys: Awaited<ReturnType<typeof getFilteredJourneysForShare>>,
  share: PublicShare,
): SanitizedJourney[] {
  return journeys.map((journey) => {
    // Create sanitized passengers array (only include user's passengers, remove sensitive data)
    const userPassengers = journey.passengers
      .filter((passenger) => passenger.userId === share.userId)
      .map((passenger) => ({
        ...passenger,
        seat: share.showSeat ? passenger.seat : null,
        seatClass: share.showSeat ? passenger.seatClass : null,
        coach: share.showSeat ? passenger.coach : null,
        seatNumber: share.showSeat ? passenger.seatNumber : null,
        userId: passenger.userId,
      }));

    const sanitized: SanitizedJourney = {
      id: journey.id,
      from: journey.from!, // Always include complete from station
      to: journey.to!, // Always include complete to station
      duration: journey.duration,
      journeyReason: userPassengers[0]?.journeyReason ?? null,
      unitNumber: share.showTrain ? journey.unitNumber : null,
      passengers: userPassengers,
    };

    // Apply privacy settings for conditional fields
    if (share.showTrainNumbers) {
      sanitized.trainNumber = journey.trainNumber;
    }

    if (share.showOperators && journey.operator) {
      sanitized.operator = journey.operator;
    }

    if (share.showTrain && journey.train) {
      sanitized.train = journey.train;
    }

    if (share.showTimes) {
      sanitized.departure = journey.departure;
      sanitized.arrival = journey.arrival;
      sanitized.departureScheduled = journey.departureScheduled;
      sanitized.arrivalScheduled = journey.arrivalScheduled;
    }

    if (share.showDates) {
      sanitized.date = journey.date;
      sanitized.datePrecision = journey.datePrecision;
    }

    return sanitized;
  });
}

/**
 * Validate and save share from form data
 */
export async function validateAndSaveShare(
  userId: string,
  shareData: z.infer<typeof shareSchema>,
): Promise<ErrorActionResult> {
  // Process expiry date based on expiry option
  let expiresAt: Date | null = null;
  if (shareData.expiryOption !== 'never') {
    const now = new Date();
    switch (shareData.expiryOption) {
      case '1day':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '1week':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (shareData.expiresAt) {
          expiresAt = new Date(shareData.expiresAt);
        }
        break;
    }
  }

  const values = {
    slug: shareData.slug,
    expiresAt,
    dateFrom: shareData.dateFrom || null,
    dateTo: shareData.dateTo || null,
    showMap: shareData.showMap,
    showStats: shareData.showStats,
    showJourneyList: shareData.showJourneyList,
    showTrainNumbers: shareData.showTrainNumbers,
    showOperators: shareData.showOperators,
    showTrain: shareData.showTrain,
    showTimes: shareData.showTimes,
    showTracks: shareData.showTracks,
    showDates: shareData.showDates,
    showSeat: shareData.showSeat,
  };
  const updating = Boolean(shareData.id);

  try {
    if (!shareData.id) await insertShare(userId, values);
    else if (!(await patchShare(userId, shareData.id, values)))
      return { success: false, type: 'error', message: 'Share not found' };
  } catch (error) {
    if (error instanceof ShareSlugTakenError)
      return { success: false, type: 'error', message: error.message };
    console.error('Error saving share:', error);
    return {
      success: false,
      type: 'error',
      message: updating ? 'Failed to update share' : 'Failed to create share',
    };
  }
  return {
    success: true,
    message: updating
      ? 'Share updated successfully'
      : 'Share created successfully',
  };
}
