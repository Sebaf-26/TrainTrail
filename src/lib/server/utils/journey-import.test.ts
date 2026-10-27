import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import type { CreateJourney } from '$lib/db/types';
import type { AuthorizationContext } from '$lib/server/authorization/context';

import {
  getMissingJourneyReferenceUpdate,
  getMissingImportPassengers,
  validateJourneyImportPermissions,
} from './journey-import';

const authorization = (
  permissions: Permission[],
  isOwner = false,
): AuthorizationContext => ({
  userId: 'current-user',
  isOwner,
  roleId: isOwner ? null : 'role-user',
  roleName: isOwner ? null : 'User',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

const user = authorization(['journey.import.own']);

const journeyWithSeats = (
  passengers: CreateJourney['passengers'],
): CreateJourney => ({ passengers }) as CreateJourney;

const guestSeat = (
  guestName: string,
  seatNumber: string | null = null,
): CreateJourney['passengers'][number] => ({
  userId: null,
  guestName,
  seat: null,
  coach: null,
  seatNumber,
  seatClass: null,
  journeyReason: null,
});

const userSeat = (userId: string): CreateJourney['passengers'][number] => ({
  ...guestSeat(''),
  userId,
  guestName: null,
});

describe('getMissingImportPassengers', () => {
  it('preserves same-name guests seated in different coaches', () => {
    const incoming = [
      { ...guestSeat('Guest Passenger', '12A'), coach: '3' },
      { ...guestSeat('Guest Passenger', '12A'), coach: '7' },
    ];

    expect(getMissingImportPassengers([], incoming)).toEqual(incoming);
  });

  it('preserves same-name guests with different seat details', () => {
    const incoming = [
      guestSeat('Guest Passenger', '12A'),
      guestSeat('Guest Passenger', '12B'),
    ];

    expect(getMissingImportPassengers([], incoming)).toEqual(incoming);
  });

  it('only skips the guest seat already on the journey', () => {
    const existing = [guestSeat('Guest Passenger', '12A')];
    const missing = getMissingImportPassengers(existing, [
      ...existing,
      guestSeat('Guest Passenger', '12B'),
    ]);

    expect(missing).toEqual([guestSeat('Guest Passenger', '12B')]);
  });

  it('preserves the number of identical guest rows', () => {
    const guest = guestSeat('Guest Passenger', '12A');

    expect(getMissingImportPassengers([guest], [guest, guest])).toEqual([
      guest,
    ]);
    expect(getMissingImportPassengers([guest, guest], [guest, guest])).toEqual(
      [],
    );
  });

  it('deduplicates repeated passengers for the same local user', () => {
    const userSeat = {
      ...guestSeat('Ignored'),
      userId: 'local-user',
      guestName: null,
    };

    expect(getMissingImportPassengers([], [userSeat, userSeat])).toEqual([
      userSeat,
    ]);
  });
});

describe('getMissingJourneyReferenceUpdate', () => {
  it('fills missing operator and train references', () => {
    expect(
      getMissingJourneyReferenceUpdate(
        { operator: null, train: null },
        { operator: { id: 12 }, train: { id: 34 } },
      ),
    ).toEqual({ operatorId: 12, trainId: 34 });
  });

  it('does not replace existing references', () => {
    expect(
      getMissingJourneyReferenceUpdate(
        {
          operator: { id: 1 },
          train: { id: 2 },
        } as Parameters<typeof getMissingJourneyReferenceUpdate>[0],
        { operator: { id: 12 }, train: { id: 34 } },
      ),
    ).toBeNull();
  });

  it('ignores unresolved incoming references', () => {
    expect(
      getMissingJourneyReferenceUpdate(
        { operator: null, train: null },
        { operator: null, train: null },
      ),
    ).toBeNull();
  });
});

describe('validateJourneyImportPermissions', () => {
  it('allows personal imports owned by the importing user', () => {
    const error = validateJourneyImportPermissions(
      user,
      [journeyWithSeats([userSeat(user.userId), guestSeat('Guest Passenger')])],
      'personal',
    );

    expect(error).toBeNull();
  });

  it('rejects personal imports that assign another local user', () => {
    const error = validateJourneyImportPermissions(
      user,
      [journeyWithSeats([userSeat(user.userId), userSeat('other-user')])],
      'personal',
    );

    expect(error).toBe('Journey 1 assigns another user as a passenger');
  });

  it('requires the importing user on every personal journey', () => {
    const error = validateJourneyImportPermissions(
      user,
      [journeyWithSeats([guestSeat('Guest Passenger')])],
      'personal',
    );

    expect(error).toBe('Journey 1 must include the importing user');
  });

  it('reserves restore mode for admins and owners', () => {
    const journey = journeyWithSeats([userSeat('other-user')]);

    expect(validateJourneyImportPermissions(user, [journey], 'restore')).toBe(
      'You cannot restore journeys for other users',
    );
    expect(
      validateJourneyImportPermissions(
        authorization(['journey.import.any']),
        [journey],
        'restore',
      ),
    ).toBeNull();
    expect(
      validateJourneyImportPermissions(
        authorization([], true),
        [journey],
        'restore',
      ),
    ).toBeNull();
  });
});
