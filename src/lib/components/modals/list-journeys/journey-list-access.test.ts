import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import { createJourneyListAccess } from './journey-list-access';

const access = (permissions: Permission[], readonly = false) =>
  createJourneyListAccess({
    authorization: { isOwner: false, permissions },
    userId: 'actor',
    readonly,
  });

const ownJourney = { passengers: [{ userId: 'actor' }] };
const otherJourney = { passengers: [{ userId: 'other' }] };

describe('journey list access model', () => {
  it('applies own permissions per journey', () => {
    const model = access(['journey.update.own', 'journey.delete.own']);
    expect(model.canUpdateJourney(ownJourney)).toBe(true);
    expect(model.canUpdateJourney(otherJourney)).toBe(false);
    expect(model.canDeleteJourney(ownJourney)).toBe(true);
    expect(model.canDeleteJourney(otherJourney)).toBe(false);
  });

  it('allows bulk deletion only when every visible journey is deletable', () => {
    expect(access(['journey.delete.own']).canBulkDelete([ownJourney])).toBe(
      true,
    );
    expect(
      access(['journey.delete.own']).canBulkDelete([ownJourney, otherJourney]),
    ).toBe(false);
  });

  it('disables every mutation in read-only contexts', () => {
    const model = access(
      ['journey.create.any', 'journey.update.any', 'journey.delete.any'],
      true,
    );
    expect(model.canCreateJourney).toBe(false);
    expect(model.canUpdateJourney(ownJourney)).toBe(false);
    expect(model.canDeleteJourney(ownJourney)).toBe(false);
  });
});
