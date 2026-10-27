import { parseJourneyScope } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getJourneyStats } from '$lib/server/api/v1/services/journeys';

export const GET = apiRoute('api-v1-get-stats', async ({ principal, event }) =>
  apiV1Data(
    await getJourneyStats(principal, parseJourneyScope(event.url.searchParams)),
  ),
);
