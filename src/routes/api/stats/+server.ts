import { json } from '@sveltejs/kit';

import { requireOperation } from '$lib/server/api/v1/access';
import { parseJourneyScope } from '$lib/server/api/v1/query';
import { getJourneyStats } from '$lib/server/api/v1/services/journeys';
import { legacyApiRoute } from '$lib/server/utils/api';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  requireOperation(principal, 'api-v1-get-stats');
  const stats = await getJourneyStats(
    principal,
    parseJourneyScope(event.url.searchParams),
  );
  return json({ success: true, stats });
});
