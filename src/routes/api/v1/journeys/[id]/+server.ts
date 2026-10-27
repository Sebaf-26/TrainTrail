import { journeyInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  deleteJourney,
  getJourney,
  updateJourney,
} from '$lib/server/api/v1/services/journeys';

export const GET = apiRoute(
  'api-v1-get-journey',
  async ({ principal, event }) =>
    apiV1Data(await getJourney(principal, parsePositiveId(event.params.id!))),
);

export const PUT = apiRoute(
  'api-v1-update-journey',
  async ({ principal, event }) => {
    const id = parsePositiveId(event.params.id!);
    const input = await parseJsonBody(event.request, journeyInputSchema);
    return apiV1Data(await updateJourney(principal, id, input));
  },
);

export const DELETE = apiRoute(
  'api-v1-delete-journey',
  async ({ principal, event }) => {
    await deleteJourney(principal, parsePositiveId(event.params.id!));
    return new Response(null, { status: 204 });
  },
);
