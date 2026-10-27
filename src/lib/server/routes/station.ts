import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import { getStation } from '$lib/server/utils/station';
import { updateStations } from '$lib/utils/data/stations/source';

export const stationRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getStation(input);
  }),
  getFromCode: authedProcedure.input(z.string()).query(async ({ input }) => {
    return (
      (await db
        .selectFrom('station')
        .selectAll()
        .where('code', 'ilike', input)
        .executeTakeFirst()) ?? null
    );
  }),
  getData: authedProcedure.query(async () => {
    const numStations = await db
      .selectFrom('station')
      .select((eb) => eb.fn.count('station.id').as('count'))
      .where('custom', '=', false)
      .executeTakeFirst();

    const customStations = await db
      .selectFrom('station')
      .selectAll()
      .where('custom', '=', true)
      .execute();

    return {
      numStations: Number(numStations?.count ?? 0),
      customStations,
    };
  }),
  delete: permissionProcedure('data.stations.manage')
    .input(z.number())
    .mutation(async ({ input }) => {
      const result = await db
        .deleteFrom('station')
        .where('id', '=', input)
        .execute();
      return result.length > 0;
    }),
  updateFromSource: permissionProcedure('data.stations.manage').mutation(
    async () => {
      return await updateStations();
    },
  ),
});
