import { z } from 'zod';

import { permissionProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { VisitedCountryStatus } from '$lib/db/types';
import { listJourneys } from '$lib/server/utils/journey';
import {
  countryCodesFromJourneys,
  isKnownCountryCode,
} from '$lib/utils/data/countries';
import {
  listVisitedCountries,
  removeVisitedCountry,
  setVisitedCountry,
} from '$lib/server/utils/visited-countries';

const VisitedCountrySchema = z.object({
  code: z.string().length(2).refine(isKnownCountryCode, {
    message: 'Unknown country code',
  }),
  status: z.enum(VisitedCountryStatus).nullable(),
  note: z.string().nullable(),
});

export const visitedCountriesRouter = router({
  list: permissionProcedure('journey.read.own').query(({ ctx }) =>
    listVisitedCountries(ctx.user.id),
  ),
  save: permissionProcedure('journey.read.own')
    .input(VisitedCountrySchema)
    .mutation(async ({ ctx, input }) => {
      const { code, status, note } = input;
      if (status) {
        await setVisitedCountry(ctx.user.id, { code, status, note });
        return true;
      }
      const result = await removeVisitedCountry(ctx.user.id, code);
      return result.length > 0;
    }),
  importJourneys: permissionProcedure('journey.read.own').mutation(
    async ({ ctx }) => {
      const journeys = await listJourneys(ctx.user.id);
      const countries = countryCodesFromJourneys(journeys);

      if (countries.size === 0) {
        return 0;
      }

      const result = await db
        .insertInto('visitedCountry')
        .values(
          Array.from(countries).map((country) => ({
            userId: ctx.user.id,
            code: country,
            status: 'visited',
          })),
        )
        .onConflict((oc) => oc.columns(['userId', 'code']).doNothing())
        .execute();
      return Number(result?.[0]?.numInsertedOrUpdatedRows || 0);
    },
  ),
});
