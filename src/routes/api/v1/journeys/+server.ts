import { journeyInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parseJourneyScope, parsePage } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Collection, apiV1Data } from '$lib/server/api/v1/response';
import {
  createJourney,
  listJourneys,
} from '$lib/server/api/v1/services/journeys';

export const GET = apiRoute(
  'api-v1-list-journeys',
  async ({ principal, event }) => {
    const { data, page } = await listJourneys(
      principal,
      parseJourneyScope(event.url.searchParams),
      parsePage(
        event.url.searchParams.get('limit'),
        event.url.searchParams.get('cursor'),
      ),
    );
    return apiV1Collection(data, page);
  },
);

export const POST = apiRoute(
  'api-v1-create-journey',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, journeyInputSchema);
    const id = await createJourney(principal, input);
    return apiV1Data(
      { id },
      { status: 201, headers: { Location: `/api/v1/journeys/${id}` } },
    );
  },
);
