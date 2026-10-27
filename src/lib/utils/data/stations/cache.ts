import { LRUCache } from 'lru-cache';

import type { Station } from '$lib/db/types';
import { api } from '$lib/trpc';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

const cacheOptions = {
  max: 100,
};
export const stationSearchCache = new LRUCache<string, Station[]>(cacheOptions);

const lookupCacheOptions = {
  max: 500,
};
const stationFromCodeCache = new LRUCache<string, CacheEntry<Station>>(
  lookupCacheOptions,
);

export async function getStationByCode(code: string): Promise<Station | null> {
  const key = code.toUpperCase();
  const cached = stationFromCodeCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.station.getFromCode.query(code)) ?? null;
  stationFromCodeCache.set(key, result ?? notFound);
  return result;
}

export function clearStationLookupCaches() {
  stationFromCodeCache.clear();
}
