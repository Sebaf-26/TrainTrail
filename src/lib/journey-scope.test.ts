import { describe, expect, it } from 'vitest';

import {
  parseJourneyScopeSearchParams,
  resolveJourneyScope,
} from './journey-scope';

describe('journey scope', () => {
  it('requires a user for user scope', () => {
    expect(
      parseJourneyScopeSearchParams(new URLSearchParams({ scope: 'user' })),
    ).toEqual({ success: false, reason: 'missing_user' });
  });

  it('rejects unknown scopes', () => {
    expect(
      parseJourneyScopeSearchParams(new URLSearchParams({ scope: 'team' })),
    ).toEqual({ success: false, reason: 'invalid_scope' });
  });

  it('resolves mine without changing explicit scopes', () => {
    expect(resolveJourneyScope({ scope: 'mine' }, 'actor')).toEqual({
      scope: 'user',
      userId: 'actor',
    });
    expect(resolveJourneyScope({ scope: 'all' }, 'actor')).toEqual({
      scope: 'all',
    });
  });
});
