import type { Train, Operator, Station, CreateJourney } from '$lib/db/types';

export type UnknownImportValues = Record<string, number[]>;

export type ImportMappings = {
  stations: Record<string, Station>;
  operators: Record<string, Operator>;
  train: Record<string, Train>;
};

export type ImportUnknowns = {
  stations: UnknownImportValues;
  operators: UnknownImportValues;
  train: UnknownImportValues;
};

export type ExportedImportUser = {
  id: string;
  username: string;
  displayName: string;
  mappedUserId: string | null;
};

export type ProcessResult = {
  journeys: CreateJourney[];
  unknowns: ImportUnknowns;
  exportedUsers: ExportedImportUser[];
  skippedRows?: number;
};

export type PlatformOptions = {
  filterOwner: boolean;
  importMode: 'personal' | 'restore';
  stationMapping?: ImportMappings['stations'];
  operatorMapping?: ImportMappings['operators'];
  trainMapping?: ImportMappings['train'];
  userMapping?: Record<string, string>;
};

export type IndexedJourney = {
  journey: CreateJourney;
  index: number;
};

export type PendingJourneyOptions = {
  allowUnknownOperators?: boolean;
  allowUnknownTrain?: boolean;
};

export const createEmptyImportMappings = (): ImportMappings => ({
  stations: {},
  operators: {},
  train: {},
});

export const createEmptyImportUnknowns = (): ImportUnknowns => ({
  stations: {},
  operators: {},
  train: {},
});

export const mergeImportMappings = (
  current: ImportMappings,
  pending: ImportMappings,
): ImportMappings => ({
  stations: { ...current.stations, ...pending.stations },
  operators: { ...current.operators, ...pending.operators },
  train: { ...current.train, ...pending.train },
});
export const getPendingJourneys = (
  journeys: CreateJourney[],
  unknowns: ImportUnknowns,
  handledIndices: ReadonlySet<number>,
  options: PendingJourneyOptions = {},
): IndexedJourney[] => {
  const unknownIndices = new Set([
    ...Object.values(unknowns.stations).flat(),
    ...(options.allowUnknownOperators
      ? []
      : Object.values(unknowns.operators).flat()),
    ...(options.allowUnknownTrain ? [] : Object.values(unknowns.train).flat()),
  ]);

  return journeys
    .map((journey, index) => ({ journey, index }))
    .filter(
      ({ index }) => !unknownIndices.has(index) && !handledIndices.has(index),
    );
};

export const getOutstandingUnknowns = (
  unknowns: ImportUnknowns,
  handledIndices: ReadonlySet<number>,
): ImportUnknowns => {
  const filterHandledIndices = (values: UnknownImportValues) => {
    const outstanding: UnknownImportValues = {};
    for (const [code, indices] of Object.entries(values)) {
      const remaining = indices.filter((index) => !handledIndices.has(index));
      if (remaining.length) outstanding[code] = remaining;
    }
    return outstanding;
  };

  return {
    stations: filterHandledIndices(unknowns.stations),
    operators: filterHandledIndices(unknowns.operators),
    train: filterHandledIndices(unknowns.train),
  };
};
