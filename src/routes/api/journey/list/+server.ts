import { json } from '@sveltejs/kit';

import { parseJourneyScope } from '$lib/server/api/v1/query';
import { visibleJourneyScope } from '$lib/server/api/v1/services/journeys';
import { legacyApiRoute } from '$lib/server/utils/api';
import { listJourneysInScope } from '$lib/server/utils/journey';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  const scope = visibleJourneyScope(
    principal,
    parseJourneyScope(event.url.searchParams),
    'read',
  );
  return json({ success: true, journeys: await listJourneysInScope(scope) });
});
