import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import {
  getOperator,
  getOperatorByCode,
  getOperatorByName,
} from '$lib/server/utils/operator';
import { syncOperators } from '$lib/server/utils/sync';

export const operatorRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getOperator(input);
  }),
  getByCode: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getOperatorByCode(input);
  }),
  getByName: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getOperatorByName(input);
  }),
  list: authedProcedure.query(async () => {
    return await db
      .selectFrom('operator')
      .selectAll()
      .orderBy('name')
      .execute();
  }),
  delete: permissionProcedure('data.operators.manage')
    .input(z.number())
    .mutation(async ({ input }) => {
      const result = await db
        .deleteFrom('operator')
        .where('id', '=', input)
        .execute();
      return result.length > 0;
    }),
  sync: permissionProcedure('data.operators.manage')
    .input(
      z.object({
        overwrite: z.boolean().optional(),
        includeDefunct: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await syncOperators(input);
    }),
});
