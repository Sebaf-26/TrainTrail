import { LRUCache } from 'lru-cache';

import type { Train } from '$lib/db/types';
import { api } from '$lib/trpc';
import type { JourneyData } from '$lib/utils';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

export const formatTrain = (journey: JourneyData) => {
  const train = journey.train?.name;
  return train && journey.unitNumber
    ? `${train} (${journey.unitNumber})`
    : train || journey.unitNumber || 'Unknown';
};

const cacheOptions = {
  max: 100,
};
export const trainSearchCache = new LRUCache<string, Train[]>(cacheOptions);

const lookupCacheOptions = {
  max: 500,
};
const trainByCodeCache = new LRUCache<string, CacheEntry<Train>>(
  lookupCacheOptions,
);
const trainByNameCache = new LRUCache<string, CacheEntry<Train>>(
  lookupCacheOptions,
);

export async function getTrainByCode(code: string): Promise<Train | null> {
  const key = code.toUpperCase();
  const cached = trainByCodeCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.train.getByCode.query(code)) ?? null;
  trainByCodeCache.set(key, result ?? notFound);
  return result;
}

export async function getTrainByName(name: string): Promise<Train | null> {
  const key = name.toLowerCase();
  const cached = trainByNameCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.train.getByName.query(name)) ?? null;
  trainByNameCache.set(key, result ?? notFound);
  return result;
}

export function clearTrainLookupCaches() {
  trainByCodeCache.clear();
  trainByNameCache.clear();
}
