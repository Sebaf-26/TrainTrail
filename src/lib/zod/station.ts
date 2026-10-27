import { z } from 'zod';

import { StationTypes, Continents } from '$lib/db/types';

/*
 * Form schema for custom stations. The code and the type are not part of the
 * form: the server generates a `custom-<random>` code and sets the type.
 */
export const stationSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'Set a name'),
  municipality: z.string(),
  // @ts-expect-error - Superforms needs an empty initial value that validation rejects
  lat: z.number({ message: 'Set the latitude' }).prefault(null),
  // @ts-expect-error - Superforms needs an empty initial value that validation rejects
  lon: z.number({ message: 'Set the longitude' }).prefault(null),
  continent: z
    .enum(Continents, { message: 'Select a continent' })
    // @ts-expect-error - Superforms needs an empty initial value that validation rejects
    .prefault(''),
  country: z.string().min(1, 'Select a country'),
  uic: z.string().optional(),
  tz: z
    .string({ message: 'Select a timezone' })
    .regex(/^[a-zA-Z]+\/[a-zA-Z_]+$/, 'Must be a valid timezone ID'),
});

export const stationFormDefaults = {
  id: null,
  name: '',
  municipality: '',
  lat: null,
  lon: null,
  continent: '',
  country: '',
  uic: '',
  tz: '',
} as unknown as z.infer<typeof stationSchema>;

/*
 * Only used inside the journey schema.
 */
export const journeyStationSchema = z.object({
  id: z.number(),
  type: z.enum(StationTypes),
  name: z.string(),
  municipality: z.string().nullable().default(null),
  lat: z.number(),
  lon: z.number(),
  continent: z.enum(Continents),
  country: z.string(),
  code: z.string(),
  uic: z.string().nullable().default(null),
  viaggiatrenoId: z.string().nullable().default(null),
  tz: z.string(),
  custom: z.boolean(),
});
