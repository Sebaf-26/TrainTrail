import {
  parseJourneyScopeSearchParams,
  type JourneyScope,
} from '$lib/journey-scope';
import { ApiOperationError } from './errors';
import { decodeCursor, type JourneyPage } from './services/journey-page';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const JOURNEY_SCOPE_ERRORS = {
  invalid_scope: 'Invalid scope',
  missing_user: 'A userId query parameter is required for user scope',
} as const;

export const parseJourneyScope = (
  searchParams: URLSearchParams,
): JourneyScope => {
  const parsed = parseJourneyScopeSearchParams(searchParams);
  if (!parsed.success)
    throw new ApiOperationError(
      'bad_request',
      JOURNEY_SCOPE_ERRORS[parsed.reason],
    );
  return parsed.data;
};

export const parsePage = (
  limitValue: string | number | null,
  cursorValue: string | null,
): JourneyPage => {
  const limit = limitValue === null ? DEFAULT_LIMIT : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT)
    throw new ApiOperationError('bad_request', 'Invalid pagination');
  if (cursorValue === null) return { limit, cursor: null };
  const cursor = decodeCursor(cursorValue);
  if (!cursor) throw new ApiOperationError('bad_request', 'Invalid cursor');
  return { limit, cursor };
};
