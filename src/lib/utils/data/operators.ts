import { LRUCache } from 'lru-cache';

import type { Operator } from '$lib/db/types';
import { api } from '$lib/trpc';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

const cacheOptions = {
  max: 100,
};
export const operatorSearchCache = new LRUCache<string, Operator[]>(
  cacheOptions,
);

const lookupCacheOptions = {
  max: 500,
};
const operatorByCodeCache = new LRUCache<string, CacheEntry<Operator>>(
  lookupCacheOptions,
);
const operatorByNameCache = new LRUCache<string, CacheEntry<Operator>>(
  lookupCacheOptions,
);

export async function getOperatorByCode(
  code: string,
): Promise<Operator | null> {
  const key = code.toUpperCase();
  const cached = operatorByCodeCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.operator.getByCode.query(code)) ?? null;
  operatorByCodeCache.set(key, result ?? notFound);
  return result;
}

export async function getOperatorByName(
  name: string,
): Promise<Operator | null> {
  const key = name.toLowerCase();
  const cached = operatorByNameCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.operator.getByName.query(name)) ?? null;
  operatorByNameCache.set(key, result ?? notFound);
  return result;
}

export function clearOperatorLookupCaches() {
  operatorByCodeCache.clear();
  operatorByNameCache.clear();
}
