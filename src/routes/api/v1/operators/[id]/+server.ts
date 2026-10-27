import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getOperator } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute('api-v1-get-operator', async ({ event }) =>
  apiV1Data(await getOperator(parsePositiveId(event.params.id!))),
);
