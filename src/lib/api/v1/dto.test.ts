import { describe, expect, it } from 'vitest';

import type { Journey, JourneyPassenger, Station } from '$lib/db/types';
import { toJourneyDto, toOperatorDto, toStationDto } from './dto';

const station = {
  id: 1,
  code: '8301700',
  uic: '8301700',
  viaggiatrenoId: 'S01700',
  name: 'Milano Centrale',
  municipality: 'Milano',
  lat: 45.4859,
  lon: 9.2046,
  tz: 'Europe/Rome',
  type: 'main',
  continent: 'EU',
  country: 'IT',
  custom: false,
} satisfies Station;

describe('station DTO', () => {
  it('exposes the rail identifiers', () => {
    expect(toStationDto(station)).toEqual({
      id: 1,
      code: '8301700',
      uic: '8301700',
      viaggiatrenoId: 'S01700',
      name: 'Milano Centrale',
      municipality: 'Milano',
      latitude: 45.4859,
      longitude: 9.2046,
      timezone: 'Europe/Rome',
      type: 'main',
      continent: 'EU',
      country: 'IT',
      custom: false,
    });
  });
});

describe('operator DTO', () => {
  it('has a short code', () => {
    const dto = toOperatorDto({
      id: 2,
      name: 'Trenitalia',
      code: 'FS',
      iconPath: null,
      sourceId: 'trenitalia',
    });

    expect(dto).toEqual({
      id: 2,
      name: 'Trenitalia',
      code: 'FS',
      iconPath: null,
    });
  });
});

describe('journey DTO', () => {
  const passenger = {
    id: 5,
    journeyId: 9,
    userId: 'user-one',
    guestName: null,
    seat: 'window',
    coach: '7',
    seatNumber: '12A',
    seatClass: 'second',
    journeyReason: 'commute',
    user: { id: 'user-one', displayName: 'User One', username: 'one' },
  } satisfies JourneyPassenger;

  const journey = {
    id: 9,
    date: '2024-06-14',
    datePrecision: 'day',
    departure: '2024-06-14T10:00:00.000Z',
    arrival: '2024-06-14T13:00:00.000Z',
    departureScheduled: null,
    arrivalScheduled: null,
    duration: 10_800,
    departurePlatform: '7',
    arrivalPlatform: '12',
    trainNumber: 'FR9617',
    unitNumber: null,
    note: null,
    from: station,
    to: null,
    operator: null,
    train: null,
    passengers: [passenger],
  } satisfies Journey;

  it('carries platforms and the passenger coach', () => {
    const dto = toJourneyDto(journey);

    expect(dto.departurePlatform).toBe('7');
    expect(dto.arrivalPlatform).toBe('12');
    expect(dto.passengers[0]).toMatchObject({
      seat: 'window',
      coach: '7',
      seatNumber: '12A',
      seatClass: 'second',
      journeyReason: 'commute',
    });
    expect(dto).not.toHaveProperty('takeoffScheduled');
    expect(dto).not.toHaveProperty('departureTerminal');
  });
});
