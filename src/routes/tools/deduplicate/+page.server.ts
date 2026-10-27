import { error, redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

import { canDeduplicateOwnJourneys } from '$lib/authorization/permissions';
import type { Journey } from '$lib/db/types';
import { listJourneys } from '$lib/server/utils/journey';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return redirect(302, '/login');
  }
  if (
    !locals.authorization ||
    !canDeduplicateOwnJourneys(locals.authorization)
  ) {
    return error(403, 'Forbidden');
  }

  const journeys = await listJourneys(user.id);
  const duplicates: Journey[] = [];
  const uniqueJourneys: Journey[] = [];

  for (const journey of journeys) {
    const hasDuplicate = uniqueJourneys.some(
      (f) =>
        f.date === journey.date &&
        f.from &&
        f.to &&
        f.from.id === journey.from?.id &&
        f.to.id === journey.to?.id,
    );

    if (hasDuplicate) {
      duplicates.push(journey);
    } else {
      uniqueJourneys.push(journey);
    }
  }

  return {
    journeys: duplicates,
  };
};
