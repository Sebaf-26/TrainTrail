import { z } from 'zod';

import type { Train, Operator, Station } from '$lib/db/types';
import { authedProcedure, router } from '$lib/server/trpc';
import { findTrain } from '$lib/server/utils/train';
import { findOperator } from '$lib/server/utils/operator';
import { findStations } from '$lib/server/utils/station';

export const autocompleteRouter = router({
  station: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Station[]> => {
      return await findStations(input);
    }),
  train: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Train[]> => {
      return (await findTrain(input)) ?? [];
    }),
  operator: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Operator[]> => {
      return (await findOperator(input)) ?? [];
    }),
});
