import type { ZodType } from 'zod';

import { operatorsDataSchema, trainListDataSchema } from '$lib/data/types';
import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';

import operatorsJson from '../../../../data/operators.json';
import trainsJson from '../../../../data/trains.json';

interface SyncResult {
  added: number;
  updated: number;
  errors: string[];
}

const logError = (errors: string[], message: string) => {
  console.warn(message);
  errors.push(message);
};

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// The reference data ships with the app, so syncing never needs the network
// and an update of the app is what brings new operators and trains.
function parseReferenceData<T>(
  name: string,
  json: unknown,
  schema: ZodType<T>,
  errors: string[],
): T | null {
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logError(errors, `Invalid ${name} reference data: ${parsed.error}`);
    return null;
  }

  return parsed.data;
}

async function upsertOperator(
  operator: { id: string; name: string; code: string | null },
  existingIds: Set<string | null>,
  overwrite: boolean,
): Promise<'added' | 'updated' | null> {
  const exists = existingIds.has(operator.id);

  if (exists && !overwrite) return null;

  if (exists) {
    await db
      .updateTable('operator')
      .set({ name: operator.name, code: operator.code })
      .where('sourceId', '=', operator.id)
      .execute();
    return 'updated';
  }

  await db
    .insertInto('operator')
    .values({
      name: operator.name,
      code: operator.code,
      sourceId: operator.id,
      iconPath: null,
    })
    .execute();
  return 'added';
}

export const syncOperators = async (options?: {
  overwrite?: boolean;
  includeDefunct?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  const operators = parseReferenceData(
    'operators',
    operatorsJson,
    operatorsDataSchema,
    result.errors,
  );
  if (!operators) return result;

  const filtered = options?.includeDefunct
    ? operators
    : operators.filter((a) => !a.defunct);

  const existing = await db
    .selectFrom('operator')
    .select(['sourceId'])
    .where('sourceId', 'is not', null)
    .execute();
  const existingIds = new Set(existing.map((e) => e.sourceId));

  for (const operator of filtered) {
    try {
      const action = await upsertOperator(
        operator,
        existingIds,
        options?.overwrite ?? false,
      );
      if (action === 'added') result.added++;
      if (action === 'updated') result.updated++;
    } catch (err) {
      logError(
        result.errors,
        `Failed to sync operator ${operator.id}: ${formatError(err)}`,
      );
    }
  }

  return result;
};

async function upsertTrain(
  train: { id: string; name: string; code: string | null },
  existingIds: Set<string | null>,
  overwrite: boolean,
): Promise<'added' | 'updated' | null> {
  const exists = existingIds.has(train.id);

  if (exists && !overwrite) return null;

  if (exists) {
    await db
      .updateTable('train')
      .set({ name: train.name, code: train.code })
      .where('sourceId', '=', train.id)
      .execute();
    return 'updated';
  }

  await db
    .insertInto('train')
    .values({ name: train.name, code: train.code, sourceId: train.id })
    .execute();
  return 'added';
}

export const syncTrain = async (options?: {
  overwrite?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  const trains = parseReferenceData(
    'trains',
    trainsJson,
    trainListDataSchema,
    result.errors,
  );
  if (!trains) return result;

  const existing = await db
    .selectFrom('train')
    .select(['sourceId'])
    .where('sourceId', 'is not', null)
    .execute();
  const existingIds = new Set(existing.map((e) => e.sourceId));

  for (const train of trains) {
    try {
      const action = await upsertTrain(
        train,
        existingIds,
        options?.overwrite ?? false,
      );
      if (action === 'added') result.added++;
      if (action === 'updated') result.updated++;
    } catch (err) {
      logError(
        result.errors,
        `Failed to sync train ${train.id}: ${formatError(err)}`,
      );
    }
  }

  return result;
};

const markDataSynced = async () => {
  await appConfig.set({ data: { lastSynced: new Date().toISOString() } });
};

export const ensureInitialDataSync = async () => {
  const config = await appConfig.get();
  if (config?.data?.lastSynced) {
    return;
  }

  console.log('Running initial data sync...');
  console.time('Initial data sync');

  const [operatorsResult, trainResult] = await Promise.all([
    syncOperators({ includeDefunct: false }),
    syncTrain(),
  ]);

  const totalAdded = operatorsResult.added + trainResult.added;
  const totalUpdated = operatorsResult.updated + trainResult.updated;
  const allErrors = [...operatorsResult.errors, ...trainResult.errors];

  if (allErrors.length > 0) {
    console.warn('Initial sync completed with errors:', allErrors);
  }

  if (totalAdded > 0 || totalUpdated > 0) {
    console.log(
      `Initial sync: added ${operatorsResult.added} operators, ${trainResult.added} trains`,
    );
  }

  await markDataSynced();
  console.timeEnd('Initial data sync');
};
