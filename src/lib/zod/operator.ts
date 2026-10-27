import { z } from 'zod';

export const operatorSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'Operator name is required'),
  code: z
    .string({ message: 'Set a short code' })
    .max(10, 'Code must be 10 characters or less')
    .regex(
      /^[\p{L}\p{N}][\p{L}\p{N} ./-]*$/u,
      'Code can only contain letters, numbers, spaces, dots, slashes and hyphens',
    )
    .nullable(),
  iconPath: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
});
