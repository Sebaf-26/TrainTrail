import { z } from 'zod';

export const baseShareSchema = z.object({
  showMap: z.boolean().default(true),
  showStats: z.boolean().default(false),
  showJourneyList: z.boolean().default(false),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  showTrainNumbers: z.boolean().default(true),
  showOperators: z.boolean().default(true),
  showTrain: z.boolean().default(false),
  showTimes: z.boolean().default(false),
  showTracks: z.boolean().default(false),
  showDates: z.boolean().default(true),
  showSeat: z.boolean().default(false),
});

export const shareSchema = z
  .object({
    id: z.number().optional(),
    slug: z
      .string()
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Share URL can only contain letters, numbers, hyphens, and underscores',
      )
      .min(1, 'Share URL is required')
      .max(50, 'Share URL must be 50 characters or less'),
    expiresAt: z.string().optional(),
    expiryOption: z
      .enum(['never', '1day', '1week', '1month', '3months', 'custom'])
      .default('never'),
  })
  .merge(baseShareSchema);
