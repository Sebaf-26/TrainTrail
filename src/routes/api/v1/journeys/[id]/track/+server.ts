import { journeyTrackInputSchema } from '$lib/track/schema';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  deleteJourneyTrack,
  getJourneyTrack,
  setJourneyTrack,
} from '$lib/server/api/v1/services/tracks';

export const GET = apiRoute(
  'api-v1-get-journey-track',
  async ({ principal, event }) =>
    apiV1Data(
      await getJourneyTrack(principal, parsePositiveId(event.params.id!)),
    ),
);

export const PUT = apiRoute(
  'api-v1-set-journey-track',
  async ({ principal, event }) => {
    const track = await parseJsonBody(event.request, journeyTrackInputSchema);
    return apiV1Data(
      await setJourneyTrack(
        principal,
        parsePositiveId(event.params.id!),
        track,
      ),
    );
  },
);

export const DELETE = apiRoute(
  'api-v1-delete-journey-track',
  async ({ principal, event }) => {
    await deleteJourneyTrack(principal, parsePositiveId(event.params.id!));
    return new Response(null, { status: 204 });
  },
);
