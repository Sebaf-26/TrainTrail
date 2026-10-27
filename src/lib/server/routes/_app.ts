import { router } from '../trpc';

import { userRouter } from './user';

import { trainRouter } from '$lib/server/routes/train';
import { operatorRouter } from '$lib/server/routes/operator';
import { stationRouter } from '$lib/server/routes/station';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';
import { customFieldRouter } from '$lib/server/routes/custom-field';
import { journeyRouter } from '$lib/server/routes/journey';
import { journeyTrackRouter } from '$lib/server/routes/journey-track';
import { oauthRouter } from '$lib/server/routes/oauth';
import { shareRouter } from '$lib/server/routes/share';
import { sqlRouter } from '$lib/server/routes/sql';
import { visitedCountriesRouter } from '$lib/server/routes/visited-countries';
import { roleRouter } from '$lib/server/routes/role';

export const appRouter = router({
  user: userRouter,
  train: trainRouter,
  operator: operatorRouter,
  station: stationRouter,
  journey: journeyRouter,
  journeyTrack: journeyTrackRouter,
  customField: customFieldRouter,
  oauth: oauthRouter,
  autocomplete: autocompleteRouter,
  share: shareRouter,
  visitedCountries: visitedCountriesRouter,
  sql: sqlRouter,
  role: roleRouter,
});

export type AppRouter = typeof appRouter;
