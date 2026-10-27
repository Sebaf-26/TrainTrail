import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import {
  getTrain,
  getTrainByCode,
  getTrainByName,
} from '$lib/server/utils/train';
import { syncTrain } from '$lib/server/utils/sync';

export const trainRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getTrain(input);
  }),
  getByCode: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getTrainByCode(input);
  }),
  getByName: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getTrainByName(input);
  }),
  list: authedProcedure.query(async () => {
    return await db.selectFrom('train').selectAll().orderBy('name').execute();
  }),
  delete: permissionProcedure('data.trains.manage')
    .input(z.number())
    .mutation(async ({ input }) => {
      const result = await db
        .deleteFrom('train')
        .where('id', '=', input)
        .execute();
      return result.length > 0;
    }),
  sync: permissionProcedure('data.trains.manage')
    .input(z.object({ overwrite: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return await syncTrain(input);
    }),
});
