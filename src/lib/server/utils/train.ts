import { z } from 'zod';
import { sql } from 'kysely';

import { db } from '$lib/db';
import type { Train } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { trainSchema } from '$lib/zod/train';

export const getTrain = async (id: number): Promise<Train | null> => {
  return (
    (await db
      .selectFrom('train')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const getTrainByCode = async (input: string): Promise<Train | null> => {
  return (
    (await db
      .selectFrom('train')
      .selectAll()
      .where('code', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getTrainByName = async (input: string): Promise<Train | null> => {
  return (
    (await db
      .selectFrom('train')
      .selectAll()
      .where('name', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findTrain = async (input: string): Promise<Train[] | null> => {
  const pattern = `%${input}%`;

  return await db
    .selectFrom('train')
    .selectAll()
    .where((eb) =>
      eb.or([eb('name', 'ilike', pattern), eb('code', 'ilike', input)]),
    )
    .select(
      sql`CASE
            WHEN "code" ILIKE ${input} THEN 1
            WHEN "name" ILIKE ${pattern} THEN 2
            ELSE 3
          END`.as('match_rank'),
    )
    .orderBy('match_rank', 'asc')
    .orderBy('name')
    .limit(10)
    .execute();
};

export const createTrain = async (data: Omit<Train, 'id'>) => {
  await db.insertInto('train').values(data).execute();
};

export const updateTrain = async (data: Train) => {
  await db.updateTable('train').set(data).where('id', '=', data.id).execute();
};

export const validateAndSaveTrain = async (
  train: z.infer<typeof trainSchema>,
): Promise<ErrorActionResult> => {
  const existingTrain = train.id ? await getTrain(train.id) : null;

  if (existingTrain) {
    try {
      await updateTrain({
        ...existingTrain,
        ...train,
        id: existingTrain.id,
        sourceId: existingTrain.sourceId,
      });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update train',
      };
    }

    return {
      success: true,
      message: 'Train updated',
    };
  } else {
    try {
      await createTrain({
        name: train.name,
        code: train.code,
        sourceId: null,
      });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create train',
      };
    }

    return {
      success: true,
      message: 'Train created',
    };
  }
};
