import { describe, expect, it } from 'vitest';

import {
  journeyOptionalInformationSchema,
  journeyPassengerInformationSchema,
} from './journey';

const passenger = {
  userId: 'user-one',
  guestName: null,
  seat: 'window',
  coach: '7',
  seatNumber: '12A',
  seatClass: 'second',
  journeyReason: 'commute',
};

describe('journeyPassengerInformationSchema', () => {
  it('accepts the rail seat vocabulary and a coach', () => {
    const parsed = journeyPassengerInformationSchema.parse({
      passengers: [passenger],
    });

    expect(parsed.passengers[0]).toMatchObject({
      seat: 'window',
      coach: '7',
      seatClass: 'second',
      journeyReason: 'commute',
    });
  });

  it('defaults the coach to null', () => {
    const { coach: _, ...withoutCoach } = passenger;
    const parsed = journeyPassengerInformationSchema.parse({
      passengers: [withoutCoach],
    });

    expect(parsed.passengers[0]?.coach).toBeNull();
  });

  it.each([
    ['seat', 'pilot'],
    ['seatClass', 'economy'],
    ['journeyReason', 'crew'],
  ])('rejects the old %s value %s', (field, value) => {
    expect(
      journeyPassengerInformationSchema.safeParse({
        passengers: [{ ...passenger, [field]: value }],
      }).success,
    ).toBe(false);
  });
});

describe('journeyOptionalInformationSchema', () => {
  const info = {
    operator: null,
    trainNumber: 'FR9617',
    train: null,
    unitNumber: null,
    note: null,
  };

  it('accepts platforms', () => {
    expect(
      journeyOptionalInformationSchema.parse({
        ...info,
        departurePlatform: '7',
        arrivalPlatform: '12',
      }),
    ).toMatchObject({ departurePlatform: '7', arrivalPlatform: '12' });
  });

  it('limits platforms to 10 characters', () => {
    expect(
      journeyOptionalInformationSchema.safeParse({
        ...info,
        departurePlatform: '12345678901',
      }).success,
    ).toBe(false);
  });
});
