import { z } from 'zod';

export interface Operator {
  id: string;
  name: string;
  code: string | null;
}

export interface Train {
  id: string;
  name: string;
  code: string | null;
}

export const operatorDataSchema = z.object({
  id: z.string().min(1, 'Operator ID is required'),
  name: z.string().min(1, 'Operator name is required'),
  code: z.string().nullable(),
  defunct: z.boolean().optional(),
});

export const trainDataSchema = z.object({
  id: z.string().min(1, 'Train ID is required'),
  name: z.string().min(1, 'Train name is required'),
  code: z.string().nullable(),
});

export const operatorsDataSchema = z.array(operatorDataSchema);
export const trainListDataSchema = z.array(trainDataSchema);
