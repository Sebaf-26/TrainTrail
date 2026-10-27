import type { PageServerLoad } from './$types';

import { DEFAULT_JOURNEY_SCOPE } from '$lib/journey-scope';
import { trpcServer } from '$lib/server/server';
import { canListJourneys } from '$lib/server/authorization/journey';

export const load: PageServerLoad = async (event) => {
  if (
    !event.locals.authorization ||
    !canListJourneys(event.locals.authorization, DEFAULT_JOURNEY_SCOPE)
  ) {
    return;
  }
  await trpcServer.journey.list.ssr({ scope: 'mine' });
  await trpcServer.journeyTrack.list.ssr({ scope: 'mine' });
};
