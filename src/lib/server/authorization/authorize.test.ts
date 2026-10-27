import { describe, expect, it } from 'vitest';

import {
  canCreateUserAccount,
  canDeduplicateOwnJourneys,
  canRestoreAllJourneys,
  canSetDefaultRole,
  normalizePermissions,
  permissionsStrictlyInclude,
  type Permission,
} from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';
import { hasPermission, permissionsAreSubset } from './authorize';
import { canActOnUserWithPermissions } from './users';

const context = (
  permissions: Permission[],
  isOwner = false,
): AuthorizationContext => ({
  userId: 'user-1',
  isOwner,
  roleId: isOwner ? null : 'role-1',
  roleName: isOwner ? null : 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

describe('RBAC authorization', () => {
  it('lets an any permission satisfy its own equivalent', () => {
    const authorization = context(['journey.read.any']);
    expect(hasPermission(authorization, 'journey.read.any')).toBe(true);
    expect(hasPermission(authorization, 'journey.read.own')).toBe(true);
  });

  it('does not let an own permission satisfy any access', () => {
    expect(
      hasPermission(context(['journey.read.own']), 'journey.read.any'),
    ).toBe(false);
  });

  it('stores broad journey grants without their redundant own equivalents', () => {
    expect(
      normalizePermissions([
        'journey.read.own',
        'journey.read.any',
        'journey.share.own',
      ]),
    ).toEqual(['journey.read.any', 'journey.share.own']);
  });

  it('prevents roles from granting permissions the actor lacks', () => {
    expect(
      permissionsAreSubset(
        ['journey.read.own', 'journey.delete.any'],
        context(['journey.read.any']),
      ),
    ).toBe(false);
  });

  it('gives the owner every permission without a role', () => {
    expect(hasPermission(context([], true), 'tools.sql.execute')).toBe(true);
  });

  it('compares role hierarchy using effective permissions', () => {
    expect(
      permissionsStrictlyInclude(['journey.read.any'], ['journey.read.own']),
    ).toBe(true);
    expect(
      permissionsStrictlyInclude(
        ['journey.read.any'],
        ['journey.read.any', 'journey.read.own'],
      ),
    ).toBe(false);
  });

  it('only manages users whose effective permissions are strictly lower', () => {
    const authorization = context(['journey.read.any']);

    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: false, roleId: 'lower-role' },
        ['journey.read.own'],
      ),
    ).toBe(true);
    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: false, roleId: 'peer-role' },
        ['journey.read.any'],
      ),
    ).toBe(false);
    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: true, roleId: null },
        [],
      ),
    ).toBe(false);
  });

  it('keeps composed actions unavailable until every permission is present', () => {
    expect(canCreateUserAccount(context(['users.create']))).toBe(false);
    expect(
      canCreateUserAccount(context(['users.create', 'users.roles.assign'])),
    ).toBe(true);

    expect(canRestoreAllJourneys(context(['journey.import.any']))).toBe(false);
    expect(
      canRestoreAllJourneys(
        context(['journey.import.any', 'users.directory.read']),
      ),
    ).toBe(true);

    expect(canDeduplicateOwnJourneys(context(['journey.delete.own']))).toBe(
      false,
    );
    expect(
      canDeduplicateOwnJourneys(
        context(['journey.read.own', 'journey.delete.own']),
      ),
    ).toBe(true);

    expect(
      canSetDefaultRole(context(['roles.manage', 'users.roles.assign'])),
    ).toBe(false);
    expect(
      canSetDefaultRole(
        context([
          'roles.manage',
          'users.roles.assign',
          'instance.oauth.manage',
        ]),
      ),
    ).toBe(true);
  });
});
