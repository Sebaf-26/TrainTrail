import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiScope } from '$lib/api/v1/scopes';
import type { Permission } from '$lib/authorization/permissions';
import type { ApiPrincipal } from './principal';

const journeyOwnership = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/authorization/journey', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('$lib/server/authorization/journey')
  >()),
  journeyOwnership,
}));

const { requireApiScope, requireJourneyScope, requireOperation } =
  await import('./access');

const principal = (
  scopes: ApiScope[],
  permissions: Permission[],
): ApiPrincipal =>
  ({
    user: { id: 'me' },
    authorization: {
      userId: 'me',
      isOwner: false,
      roleId: 'role',
      roleName: 'Role',
      roleAssignmentSource: 'local',
      permissions: new Set(permissions),
    },
    credential: { kind: 'apiKey', keyId: 1, scopes: new Set(scopes) },
  }) as unknown as ApiPrincipal;

beforeEach(() => journeyOwnership.mockReset());

describe('requireApiScope', () => {
  it('tells a missing scope apart from a role that forbids it', () => {
    expect(() =>
      requireApiScope(principal([], ['journey.read.own']), 'journey.read.own'),
    ).toThrow(expect.objectContaining({ code: 'insufficient_scope' }));
    expect(() =>
      requireApiScope(principal(['journey.read.own'], []), 'journey.read.own'),
    ).toThrow(expect.objectContaining({ code: 'forbidden' }));
  });
});

describe('requireOperation', () => {
  it('requires every registered scope', () => {
    const caller = principal(['stats.read'], ['journey.read.own']);
    expect(() => requireOperation(caller, 'api-v1-get-stats')).toThrow(
      'journey.read.own',
    );
  });
});

describe('requireJourneyScope', () => {
  it("needs the .any scope for someone else's journey", async () => {
    journeyOwnership.mockResolvedValue('any');
    const caller = principal(['journey.read.own'], ['journey.read.any']);
    await expect(requireJourneyScope(caller, 'read', 1)).rejects.toMatchObject({
      code: 'insufficient_scope',
    });
  });

  it("hides someone else's journey from an own-only role", async () => {
    journeyOwnership.mockResolvedValue('any');
    const caller = principal(['journey.read.any'], ['journey.read.own']);
    await expect(requireJourneyScope(caller, 'read', 1)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('accepts the .own scope on a journey the caller is on', async () => {
    journeyOwnership.mockResolvedValue('own');
    const caller = principal(['journey.update.own'], ['journey.update.own']);
    await expect(requireJourneyScope(caller, 'update', 1)).resolves.toBe('own');
  });
});
