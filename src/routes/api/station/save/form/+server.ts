import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { hasPermission } from '$lib/server/authorization/authorize';
import { validateAndSaveStation } from '$lib/server/utils/station';
import { handleErrorActionResult } from '$lib/utils/forms';
import { stationFormDefaults, stationSchema } from '$lib/zod/station';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(
    formData,
    zod(stationSchema, { defaults: stationFormDefaults }),
  );
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  if (!locals.authorization) {
    form.message = { type: 'error', text: 'Not logged in' };
    return actionResult('failure', { form });
  }

  if (!hasPermission(locals.authorization, 'data.stations.manage')) {
    form.message = { type: 'error', text: 'Unauthorized' };
    return actionResult('failure', { form });
  }

  const result = await validateAndSaveStation(form.data);
  return handleErrorActionResult(form, result);
};
