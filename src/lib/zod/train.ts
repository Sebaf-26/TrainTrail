import { z } from 'zod';

export const trainSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'Train name is required'),
  code: z
    .string({ message: 'Set a model code' })
    .max(20, 'Model code must be 20 characters or less')
    .regex(
      /^[\p{L}\p{N}][\p{L}\p{N} ./-]*$/u,
      'Model code can only contain letters, numbers, spaces, dots, slashes and hyphens',
    )
    .nullable(),
});
