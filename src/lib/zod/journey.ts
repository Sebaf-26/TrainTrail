import { z } from 'zod';

import {
  JourneyDatePrecisions,
  JourneyReasons,
  SeatClasses,
  SeatTypes,
} from '$lib/db/types';
import { journeyStationSchema } from '$lib/zod/station';
import { trainSchema } from '$lib/zod/train';
import { operatorSchema } from '$lib/zod/operator';
import { journeyTrackInputSchema } from '$lib/track/schema';

const regex24h = /^([01]?\d|2[0-3])(?::|\.|)[0-5]\d(?:\s?(?:am|pm))?$/i;
const regex12hLike = /^\d{1,2}(?::|\.|)\d{2}\s?(?:am|pm)$/i;
const regex12h = /^([1-9]|1[0-2])(?::|\.|)[0-5]\d\s?(?:am|pm)$/i;

const timePrimitive = z
  .string()
  .refine((value) => {
    // Always allow empty string (to allow the user to delete the input)
    if (value === '') return true;

    return regex24h.test(value);
  }, 'Invalid 24-hour format')
  .refine((value) => {
    // Skip 12-hour check if empty or not possibly 12-hour format (caught by the previous refine)
    if (value === '' || !regex12hLike.test(value)) return true;

    return regex12h.test(value);
  }, 'Invalid 12-hour format')
  .nullable();

const dateTimePrimitive = z.string().datetime({ offset: true });

type JourneyDepartureDateFields = {
  datePrecision: (typeof JourneyDatePrecisions)[number];
  departure: string | null;
  departureScheduled: string | null;
};

export const validateJourneyDepartureDate = (
  data: JourneyDepartureDateFields,
  ctx: z.RefinementCtx,
) => {
  if (data.datePrecision !== 'day') {
    if (!data.departure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departure'],
        message: 'Select a departure date',
      });
    }
    return;
  }

  if (!data.departure && !data.departureScheduled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['departure'],
      message: 'Select a departure date',
    });
  }
};

export const journeyStationsSchema = z.object({
  from: journeyStationSchema
    .nullable()
    .default(null)
    .refine((value) => value !== null, 'Select a departure station'),
  to: journeyStationSchema
    .nullable()
    .default(null)
    .refine((value) => value !== null, 'Select an arrival station'),
});

export const journeyDateTimeSchema = z.object({
  datePrecision: z.enum(JourneyDatePrecisions).default('day'),
  departure: z
    .string()
    .datetime({ offset: true, message: 'Select a departure date' })
    .nullable(),
  departureTime: timePrimitive,
  departureScheduled: dateTimePrimitive.nullable(),
  departureScheduledTime: timePrimitive,
  arrival: z
    .string()
    .datetime({ offset: true, message: 'Select an arrival date' })
    .nullable(),
  arrivalTime: timePrimitive,
  arrivalScheduled: dateTimePrimitive.nullable(),
  arrivalScheduledTime: timePrimitive,
});

export const journeyPassengerInformationSchema = z.object({
  passengers: z
    .object({
      id: z.number().int().positive().optional(),
      userId: z.string().nullable(),
      guestName: z.string().max(50, 'Guest name is too long').nullable(),
      seat: z.enum(SeatTypes).nullable(),
      coach: z.string().max(10, 'Coach is too long').nullable().default(null),
      seatNumber: z.string().max(5, 'Seat number is too long').nullable(), // 12A for example
      seatClass: z.enum(SeatClasses).nullable(),
      journeyReason: z.enum(JourneyReasons).nullable().default(null),
      customFields: z.record(z.string(), z.unknown()).default({}),
    })
    .refine((data) => data.userId ?? data.guestName, {
      message: 'Select a user or add a guest name',
      path: ['userId'],
    })
    .array()
    .min(1, 'Add at least one passenger')
    .refine((data) => data.some((passenger) => passenger.userId), {
      message: 'At least one passenger must be assigned to a user',
    })
    .default([
      {
        userId: '<USER_ID>',
        guestName: null,
        seat: null,
        coach: null,
        seatNumber: null,
        seatClass: null,
        journeyReason: null,
        customFields: {},
      },
    ]),
});

export const journeyOptionalInformationSchema = z.object({
  id: z.number().optional(), // Only for editing an existing journey
  operator: operatorSchema.nullable(),
  trainNumber: z.string().max(10, 'Train number is too long').nullable(), // should cover all cases
  train: trainSchema.nullable(),
  unitNumber: z.string().max(10, 'Unit number is too long').nullable(),
  note: z.string().max(1000, 'Note is too long').nullable(),
  departurePlatform: z.string().max(10).nullable().optional(),
  arrivalPlatform: z.string().max(10).nullable().optional(),
});

export const journeyCustomFieldsSchema = z.object({
  // Map of custom field key/fieldId -> value.
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const journeyTrackSchema = z.object({
  track: journeyTrackInputSchema.nullable().optional(),
});

export const journeySchema = journeyStationsSchema
  .merge(journeyDateTimeSchema)
  .merge(journeyOptionalInformationSchema)
  .merge(journeyPassengerInformationSchema)
  .merge(journeyCustomFieldsSchema)
  .merge(journeyTrackSchema);

export const journeyFormSchema = journeySchema.superRefine(
  validateJourneyDepartureDate,
);

export type JourneyFormData = z.infer<typeof journeySchema>;
