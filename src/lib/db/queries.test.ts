import { describe, expect, it } from 'vitest';

import { resolveJourneyPassengerChanges } from './queries';
import type { CreateJourneyPassenger } from './types';

const passenger = (
  userId: string | null,
  guestName: string | null = null,
): CreateJourneyPassenger => ({
  userId,
  guestName,
  seat: null,
  coach: null,
  seatNumber: null,
  seatClass: null,
  journeyReason: null,
});

describe('resolveJourneyPassengerChanges', () => {
  const existing = [
    { id: 1, userId: 'user-one', guestName: null },
    { id: 2, userId: null, guestName: 'Guest' },
  ];

  it('preserves IDs supplied by the journey form', () => {
    const incoming = { ...passenger('user-one'), id: 1 };
    const result = resolveJourneyPassengerChanges(existing, [incoming]);

    expect(result.resolved[0]?.existing?.id).toBe(1);
    expect(result.removedIds).toEqual([2]);
  });

  it('preserves IDs for legacy payloads by passenger identity', () => {
    const result = resolveJourneyPassengerChanges(existing, [
      passenger(null, 'Guest'),
    ]);

    expect(result.resolved[0]?.existing?.id).toBe(2);
    expect(result.removedIds).toEqual([1]);
  });

  it('rejects IDs from another journey', () => {
    expect(() =>
      resolveJourneyPassengerChanges(existing, [
        { ...passenger('user-one'), id: 99 },
      ]),
    ).toThrow('Passenger does not belong to this journey');
  });
});
