import { json } from '@sveltejs/kit';

import { requireJourneyScope } from '$lib/server/api/v1/access';
import { apiError, legacyApiRoute } from '$lib/server/utils/api';
import { getJourney } from '$lib/server/utils/journey';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  const id = Number(event.params.id);
  if (!Number.isSafeInteger(id)) {
    return apiError('Journey id is not a number', 400);
  }

  const journey = await getJourney(id);
  if (!journey) {
    return apiError('Journey not found', 404);
  }
  await requireJourneyScope(principal, 'read', id);
  return json({ success: true, journey });
});
