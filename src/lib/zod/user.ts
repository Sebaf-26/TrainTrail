import { z } from 'zod';

export const distanceUnitSchema = z.enum(['km', 'mi']);
export const timeFormatSchema = z.enum(['12h', '24h', 'auto']);
export const dateFormatSchema = z.enum(['iso', 'us', 'eu', 'auto']);
export const weekStartsOnSchema = z.enum(['mon', 'sun', 'auto']);
export const journeyTimeDisplaySchema = z.enum(['station', 'utc', 'system']);

export type DistanceUnit = z.infer<typeof distanceUnitSchema>;
export type TimeFormat = z.infer<typeof timeFormatSchema>;
export type DateFormat = z.infer<typeof dateFormatSchema>;
export type WeekStartsOn = z.infer<typeof weekStartsOnSchema>;
export type JourneyTimeDisplay = z.infer<typeof journeyTimeDisplaySchema>;

export const preferencesSchema = z.object({
  distanceUnit: distanceUnitSchema.default('km'),
  timeFormat: timeFormatSchema.default('auto'),
  dateFormat: dateFormatSchema.default('auto'),
  weekStartsOn: weekStartsOnSchema.default('auto'),
  journeyTimeDisplay: journeyTimeDisplaySchema.default('station'),
});
export type Preferences = z.infer<typeof preferencesSchema>;

// Not `preferencesSchema.partial()`: Zod 4 still applies defaults inside
// optional fields, so every omitted preference would be reset to its default.
export const updatePreferencesSchema = z.object({
  distanceUnit: distanceUnitSchema.optional(),
  timeFormat: timeFormatSchema.optional(),
  dateFormat: dateFormatSchema.optional(),
  weekStartsOn: weekStartsOnSchema.optional(),
  journeyTimeDisplay: journeyTimeDisplaySchema.optional(),
});
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;

export const usernameSchema = z
  .string()
  .nonempty()
  .min(3, { message: 'Username must be at least 3 characters long' })
  .max(20, { message: 'Username must be at most 20 characters long' })
  .regex(/^[A-Za-z0-9._-]+$/, {
    message:
      'Username can only contain letters, numbers, periods, underscores, and hyphens',
  });

export const userSchema = z.object({
  username: usernameSchema,
  password: z.string().nonempty().min(8),
  displayName: z.string().nonempty().min(3),
  roleId: z.string().min(1),
});

export const editUserSchema = userSchema.omit({ password: true, roleId: true });
export const adminEditUserSchema = userSchema
  .omit({ password: true })
  .extend({ id: z.string() });
export const editPasswordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Must be at least 8 characters long'),
    newPassword: z.string().min(8, 'Must be at least 8 characters long'),
    confirmPassword: z.string(),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
    if (newPassword !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
    if (newPassword && currentPassword === newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password must be different from current password',
        path: ['newPassword'],
      });
    }
  });

export const addUserSchema = userSchema;

export const createApiKeySchema = z.object({
  name: z.string(),
});
