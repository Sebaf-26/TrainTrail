import { z } from 'zod';

export const journeyTrackSourceFormats = [
  'gpx',
  'kml',
  'csv',
  'readsb',
] as const;
export const MAX_STORED_JOURNEY_TRACK_POINTS = 100_000;
export const MAX_RENDERED_JOURNEY_TRACK_POINTS = 5_000;

export const journeyTrackCoordinateSchema = z
  .union([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ])
  .refine(
    ([lon, lat, alt]) =>
      Number.isFinite(lon) &&
      lon >= -180 &&
      lon <= 180 &&
      Number.isFinite(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      (alt === undefined || Number.isFinite(alt)),
    'Invalid track coordinate',
  );

export type JourneyTrackSample = {
  coordinate: JourneyTrackCoordinate;
  point: {
    time?: number;
    groundSpeedKt?: number;
    trackDeg?: number;
    ground?: boolean;
  };
  incomingEdge: {
    estimated?: boolean;
  };
};

const alignedProperty = <T>(
  schema: z.ZodType<T>,
  get: (sample: JourneyTrackSample) => T | undefined,
  set: (sample: JourneyTrackSample, value: T) => void,
) => ({
  schema,
  get,
  set: (sample: JourneyTrackSample, value: unknown) => set(sample, value as T),
});

const journeyTrackAlignedPropertyDefinitions = {
  times: alignedProperty(
    z.number().int(),
    (sample) => sample.point.time,
    (sample, value) => (sample.point.time = value),
  ),
  groundSpeedKt: alignedProperty(
    z.number(),
    (sample) => sample.point.groundSpeedKt,
    (sample, value) => (sample.point.groundSpeedKt = value),
  ),
  trackDeg: alignedProperty(
    z.number(),
    (sample) => sample.point.trackDeg,
    (sample, value) => (sample.point.trackDeg = value),
  ),
  ground: alignedProperty(
    z.boolean(),
    (sample) => sample.point.ground,
    (sample, value) => (sample.point.ground = value),
  ),
  estimated: alignedProperty(
    z.boolean(),
    (sample) => sample.incomingEdge.estimated,
    (sample, value) => (sample.incomingEdge.estimated = value),
  ),
} as const;

type AlignedPropertySchemas<
  Definitions extends Record<string, { schema: z.ZodType }>,
> = {
  [Key in keyof Definitions]: z.ZodOptional<
    z.ZodArray<Definitions[Key]['schema']>
  >;
};

const journeyTrackAlignedPropertySchemas = Object.fromEntries(
  Object.entries(journeyTrackAlignedPropertyDefinitions).map(
    ([key, definition]) => [
      key,
      definition.schema.array().max(MAX_STORED_JOURNEY_TRACK_POINTS).optional(),
    ],
  ),
) as AlignedPropertySchemas<typeof journeyTrackAlignedPropertyDefinitions>;
type JourneyTrackAlignedPropertyKey =
  keyof typeof journeyTrackAlignedPropertySchemas;
const journeyTrackAlignedPropertyKeys = Object.keys(
  journeyTrackAlignedPropertySchemas,
) as JourneyTrackAlignedPropertyKey[];

const journeyTrackPayloadBaseSchema = z.object({
  coordinates: journeyTrackCoordinateSchema
    .array()
    .min(2)
    .max(MAX_STORED_JOURNEY_TRACK_POINTS),
  ...journeyTrackAlignedPropertySchemas,
});

const hasAlignedTrackProperties = (
  track: z.infer<typeof journeyTrackPayloadBaseSchema>,
) =>
  journeyTrackAlignedPropertyKeys.every((key) => {
    const values = track[key];
    return values === undefined || values.length === track.coordinates.length;
  });

export const journeyTrackPayloadSchema = journeyTrackPayloadBaseSchema.refine(
  hasAlignedTrackProperties,
  'Track properties must align with coordinates',
);

export const journeyTrackInputSchema = journeyTrackPayloadBaseSchema
  .extend({
    sourceFormat: z.enum(journeyTrackSourceFormats),
    sourceName: z.string().max(255).nullable().optional(),
  })
  .refine(
    hasAlignedTrackProperties,
    'Track properties must align with coordinates',
  );

export type JourneyTrackSourceFormat =
  (typeof journeyTrackSourceFormats)[number];
export type JourneyTrackCoordinate = z.infer<
  typeof journeyTrackCoordinateSchema
>;
export type JourneyTrackPayload = z.infer<typeof journeyTrackPayloadSchema>;
export type JourneyTrackInput = z.infer<typeof journeyTrackInputSchema>;
export type JourneyTrackRow = JourneyTrackInput & {
  journeyId: number;
  pointCount: number;
};

export type JourneyTrackAlignedProperties = Pick<
  JourneyTrackPayload,
  JourneyTrackAlignedPropertyKey
>;

type JourneyTrackPayloadSource = Pick<JourneyTrackPayload, 'coordinates'> &
  JourneyTrackAlignedProperties;

type JourneyTrackCopyOptions = {
  includeTimes?: boolean;
};

export const copyJourneyTrackAlignedProperties = (
  track: JourneyTrackAlignedProperties,
  { includeTimes = true }: JourneyTrackCopyOptions = {},
): JourneyTrackAlignedProperties => {
  const properties: JourneyTrackAlignedProperties = {};

  for (const key of journeyTrackAlignedPropertyKeys) {
    if (key === 'times' && !includeTimes) continue;
    const values = track[key];
    if (values !== undefined) {
      Object.assign(properties, { [key]: values });
    }
  }

  return properties;
};

export const toJourneyTrackSamples = (
  track: JourneyTrackPayloadSource,
): JourneyTrackSample[] => {
  const samples = track.coordinates.map((coordinate) => ({
    coordinate,
    point: {},
    incomingEdge: {},
  }));

  for (const key of journeyTrackAlignedPropertyKeys) {
    const values = track[key];
    if (values === undefined) continue;
    const definition = journeyTrackAlignedPropertyDefinitions[key];
    values.forEach((value, index) => definition.set(samples[index]!, value));
  }

  return samples;
};

const collectSampleProperty = <T>(
  samples: JourneyTrackSample[],
  getValue: (sample: JourneyTrackSample) => T | undefined,
) => {
  const values = samples.map(getValue);
  if (values.every((value) => value === undefined)) return undefined;
  if (values.some((value) => value === undefined)) {
    throw new Error('Track sample properties must be present for every point');
  }
  return values as T[];
};

export const fromJourneyTrackSamples = (
  samples: JourneyTrackSample[],
): JourneyTrackPayload => {
  const properties: JourneyTrackAlignedProperties = {};

  for (const key of journeyTrackAlignedPropertyKeys) {
    const definition = journeyTrackAlignedPropertyDefinitions[key];
    const values = collectSampleProperty(samples, (sample) =>
      definition.get(sample),
    );
    if (values !== undefined) {
      Object.assign(properties, { [key]: values });
    }
  }

  return {
    coordinates: samples.map((sample) => sample.coordinate),
    ...properties,
  };
};

export const pickJourneyTrackPoints = (
  track: JourneyTrackPayload,
  indices: number[],
): JourneyTrackPayload => {
  const properties: JourneyTrackAlignedProperties = {};

  for (const key of journeyTrackAlignedPropertyKeys) {
    const values = track[key];
    if (values !== undefined) {
      Object.assign(properties, {
        [key]: indices.map((index) => values[index]!),
      });
    }
  }

  return {
    coordinates: indices.map((index) => track.coordinates[index]!),
    ...properties,
  };
};

export const toJourneyTrackPayload = (
  track: JourneyTrackPayloadSource,
  options?: JourneyTrackCopyOptions,
): JourneyTrackPayload => ({
  coordinates: track.coordinates,
  ...copyJourneyTrackAlignedProperties(track, options),
});

export const toJourneyTrackInput = (
  track: JourneyTrackPayloadSource & {
    sourceFormat: JourneyTrackSourceFormat;
    sourceName?: string | null;
  },
  options?: JourneyTrackCopyOptions,
): JourneyTrackInput => ({
  ...toJourneyTrackPayload(track, options),
  sourceFormat: track.sourceFormat,
  sourceName: track.sourceName,
});
