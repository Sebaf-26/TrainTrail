import { backupDownload, parseBackupFormat } from '$lib/server/utils/backup';
import { ApiOperationError } from '$lib/server/api/v1/errors';
import { parseJourneyScope } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { exportJourneys } from '$lib/server/api/v1/services/journeys';

export const GET = apiRoute(
  'api-v1-export-journeys',
  async ({ principal, event }) => {
    const format = parseBackupFormat(event.url.searchParams.get('format'));
    if (!format) throw new ApiOperationError('bad_request', 'Invalid format');
    const backup = await exportJourneys(
      principal,
      parseJourneyScope(event.url.searchParams),
    );
    return backupDownload(backup, format, {
      'Cache-Control': 'private, no-store',
    });
  },
);
