import { z } from 'zod';
import { sql } from 'kysely';

import { db } from '$lib/db';
import type { Operator } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { operatorSchema } from '$lib/zod/operator';

export const getOperator = async (id: number): Promise<Operator | null> => {
  return (
    (await db
      .selectFrom('operator')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const getOperatorByCode = async (
  input: string,
): Promise<Operator | null> => {
  return (
    (await db
      .selectFrom('operator')
      .selectAll()
      .where('code', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getOperatorByName = async (
  input: string,
): Promise<Operator | null> => {
  return (
    (await db
      .selectFrom('operator')
      .selectAll()
      .where('name', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findOperator = async (
  input: string,
): Promise<Operator[] | null> => {
  const pattern = `%${input}%`;

  return await db
    .selectFrom('operator')
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

export const createOperator = async (
  data: Omit<Operator, 'id'>,
): Promise<number> => {
  const result = await db
    .insertInto('operator')
    .values(data)
    .returning('id')
    .executeTakeFirstOrThrow();
  return result.id;
};

export const updateOperator = async (data: Operator) => {
  await db
    .updateTable('operator')
    .set(data)
    .where('id', '=', data.id)
    .execute();
};

export const validateAndSaveOperator = async (
  operator: z.infer<typeof operatorSchema>,
): Promise<ErrorActionResult> => {
  const existingOperator = operator.id ? await getOperator(operator.id) : null;

  if (existingOperator) {
    try {
      await db
        .updateTable('operator')
        .set({
          name: operator.name,
          code: operator.code,
        })
        .where('id', '=', existingOperator.id)
        .execute();
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update operator',
      };
    }

    return {
      success: true,
      message: 'Operator updated',
    };
  } else {
    let newId: number;
    try {
      newId = await createOperator({
        name: operator.name,
        code: operator.code,
        sourceId: null,
        iconPath: operator.iconPath ?? null,
      });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create operator',
      };
    }

    return {
      success: true,
      message: 'Operator created',
      id: newId,
    };
  }
};
