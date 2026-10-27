import { z } from 'zod';
import {
  JourneyDatePrecisions,
  JourneyReasons,
  SeatClasses,
  SeatTypes,
  VisitedCountryStatus,
} from '$lib/db/types';
import { journeyTrackInputSchema } from '$lib/track/schema';
import { isKnownCountryCode } from '$lib/utils/data/countries';

const nullableText = z.string().max(500).nullable().optional().default(null);
const nullableDateTime = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .default(null);

export const passengerInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    userId: z.string().min(1).nullable().default(null),
    guestName: z.string().trim().min(1).max(100).nullable().default(null),
    seat: z.enum(SeatTypes).nullable().default(null),
    coach: z.string().max(20).nullable().default(null),
    seatNumber: z.string().max(20).nullable().default(null),
    seatClass: z.enum(SeatClasses).nullable().default(null),
    journeyReason: z.enum(JourneyReasons).nullable().default(null),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.guestName),
    'Exactly one of userId and guestName is required',
  );

export const journeyInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  datePrecision: z.enum(JourneyDatePrecisions).default('day'),
  departure: nullableDateTime,
  arrival: nullableDateTime,
  departureScheduled: nullableDateTime,
  arrivalScheduled: nullableDateTime,
  duration: z.number().int().nonnegative().nullable().optional().default(null),
  departurePlatform: nullableText,
  arrivalPlatform: nullableText,
  trainNumber: nullableText,
  unitNumber: nullableText,
  note: z.string().max(10_000).nullable().optional().default(null),
  fromId: z.number().int().positive(),
  toId: z.number().int().positive(),
  trainId: z.number().int().positive().nullable().optional().default(null),
  operatorId: z.number().int().positive().nullable().optional().default(null),
  passengers: z.array(passengerInputSchema).min(1),
  track: journeyTrackInputSchema.nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
});

export const visitedCountryInputSchema = z.object({
  code: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase())
    .refine(isKnownCountryCode, 'Unknown country code'),
  status: z.enum(VisitedCountryStatus),
  note: z.string().max(1000).nullable().optional().default(null),
});

export const shareInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .nullable()
    .optional()
    .default(null),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .default(null),
  showMap: z.boolean().default(true),
  showStats: z.boolean().default(false),
  showJourneyList: z.boolean().default(false),
  dateFrom: z.string().nullable().optional().default(null),
  dateTo: z.string().nullable().optional().default(null),
  showTrainNumbers: z.boolean().default(true),
  showOperators: z.boolean().default(true),
  showTrain: z.boolean().default(false),
  showTimes: z.boolean().default(false),
  showTracks: z.boolean().default(false),
  showDates: z.boolean().default(true),
  showSeat: z.boolean().default(false),
});
