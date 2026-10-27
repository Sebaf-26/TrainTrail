import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';
import {
  canCreateJourney,
  canExportJourneys,
  canListJourneys,
  canShareOwnJourneys,
} from './journey';

const context = (permissions: Permission[]): AuthorizationContext => ({
  userId: 'actor',
  isOwner: false,
  roleId: 'role',
  roleName: 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

const actor = { userId: 'actor' };
const other = { userId: 'other' };

describe('journey authorization policy', () => {
  it.each([
    {
      name: 'creates a personal journey with create-own',
      permissions: ['journey.create.own'],
      passengers: [actor],
      allowed: true,
    },
    {
      name: 'does not create for someone else with create-own',
      permissions: ['journey.create.own'],
      passengers: [other],
      allowed: false,
    },
    {
      name: 'creates for one other passenger with create-any',
      permissions: ['journey.create.any'],
      passengers: [other],
      allowed: true,
    },
    {
      name: 'requires passenger management for multiple personal passengers',
      permissions: ['journey.create.own'],
      passengers: [actor, other],
      allowed: false,
    },
    {
      name: 'creates multiple personal passengers with passenger management',
      permissions: ['journey.create.own', 'journey.passengers.manage.own'],
      passengers: [actor, other],
      allowed: true,
    },
  ] satisfies Array<{
    name: string;
    permissions: Permission[];
    passengers: Array<{ userId: string }>;
    allowed: boolean;
  }>)('$name', ({ permissions, passengers, allowed }) => {
    expect(canCreateJourney(context(permissions), passengers)).toBe(allowed);
  });

  it('uses one scope rule for listing and exporting', () => {
    const own = context(['journey.read.own', 'journey.export.own']);
    expect(canListJourneys(own, { scope: 'mine' })).toBe(true);
    expect(canListJourneys(own, { scope: 'all' })).toBe(false);
    expect(canExportJourneys(own, { scope: 'mine' })).toBe(true);
    expect(canExportJourneys(own, { scope: 'user', userId: 'other' })).toBe(
      false,
    );
  });

  it('requires both read and publish permission for a share', () => {
    expect(canShareOwnJourneys(context(['journey.read.own']))).toBe(false);
    expect(canShareOwnJourneys(context(['journey.share.own']))).toBe(false);
    expect(
      canShareOwnJourneys(context(['journey.read.own', 'journey.share.own'])),
    ).toBe(true);
  });
});
