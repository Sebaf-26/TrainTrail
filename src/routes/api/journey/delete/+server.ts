import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { deleteJourney } from '$lib/server/api/v1/services/journeys';
import { legacyApiRoute } from '$lib/server/utils/api';

const deleteJourneySchema = z.object({
  id: z.number(),
});

export const POST = legacyApiRoute(async ({ principal, event }) => {
  const parsed = deleteJourneySchema.safeParse(await event.request.json());
  if (!parsed.success) {
    return json(
      { success: false, errors: parsed.error.issues },
      { status: 400 },
    );
  }

  await deleteJourney(principal, parsed.data.id);
  return json({ success: true });
});
