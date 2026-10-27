import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processTrainTrailFile } from './traintrail';

const {
  getStationByCode,
  getOperatorByCode,
  getOperatorByName,
  getTrainByCode,
  getTrainByName,
  userListQuery,
  currentUser,
} = vi.hoisted(() => ({
  getStationByCode: vi.fn(async (code: string) => ({
    id: 1,
    code,
    tz: 'UTC',
  })),
  getOperatorByCode: vi.fn(async (code: string) => ({
    id: 2,
    code,
    name: `${code} Operator`,
  })),
  getOperatorByName: vi.fn(async (name: string) => ({
    id: 3,
    code: null,
    name,
  })),
  getTrainByCode: vi.fn(async (code: string) => ({
    id: 4,
    code,
    name: `${code} Train`,
  })),
  getTrainByName: vi.fn(async (name: string) => ({
    id: 5,
    code: null,
    name,
  })),
  userListQuery: vi.fn(async () => [
    {
      id: 'local-user',
      username: 'john',
      displayName: 'John Local',
    },
  ]),
  currentUser: {
    id: 'local-user',
    username: 'john',
    role: 'user',
  },
}));

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: currentUser,
    },
  },
}));

vi.mock('$lib/trpc', () => ({
  api: {
    user: {
      list: {
        query: userListQuery,
      },
    },
  },
}));

vi.mock('$lib/utils/data/stations/cache', () => ({
  getStationByCode,
}));

vi.mock('$lib/utils/data/operators', () => ({
  getOperatorByCode,
  getOperatorByName,
}));

vi.mock('$lib/utils/data/train', () => ({
  getTrainByCode,
  getTrainByName,
}));

const baseOptions = {
  filterOwner: false,
  importMode: 'personal' as const,
};

const exportedUsers = [
  {
    id: 'export-user',
    username: 'john',
    displayName: 'John Export',
  },
];

const seat = {
  userId: 'export-user',
  guestName: null,
  seat: 'window',
  coach: '7',
  seatNumber: '12A',
  seatClass: 'second',
  journeyReason: 'leisure',
  customFields: {},
};

const journeyBase = {
  date: '2024-06-14',
  departure: '2024-06-14T10:00:00.000Z',
  arrival: '2024-06-14T13:00:00.000Z',
  duration: 10800,
  trainNumber: 'FR9617',
  unitNumber: null,
  note: null,
  passengers: [seat],
};

const MILANO_CENTRALE = '8301700';
const ROMA_TERMINI = '8308409';

const stationObject = (code: string, id?: number) => ({
  ...(id ? { id } : {}),
  type: 'main',
  name: `Station ${code}`,
  municipality: null,
  lat: 45.0,
  lon: 9.0,
  continent: 'EU',
  country: 'IT',
  code,
  uic: code,
  viaggiatrenoId: null,
  tz: 'Europe/Rome',
  custom: false,
});

describe('processTrainTrailFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(currentUser, {
      id: 'local-user',
      username: 'john',
      role: 'user',
    });
    userListQuery.mockResolvedValue([
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
    ]);
  });

  it('imports JSON exports with nested station, operator, and train objects', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      journeys: [
        {
          ...journeyBase,
          datePrecision: 'month',
          from: stationObject(MILANO_CENTRALE),
          to: stationObject(ROMA_TERMINI),
          operator: {
            name: 'Trenitalia',
            code: 'FS',
          },
          train: {
            name: 'Frecciarossa 1000',
            code: 'ETR 400',
          },
          departureScheduled: '2024-06-14T09:45:00.000Z',
          arrivalScheduled: '2024-06-14T12:58:00.000Z',
          departurePlatform: '7',
          arrivalPlatform: '12',
        },
      ],
    });

    const result = await processTrainTrailFile(content, baseOptions);

    expect(result.journeys).toHaveLength(1);
    expect(result.unknowns.stations).toEqual({});
    expect(result.unknowns.operators).toEqual({});
    expect(getStationByCode).toHaveBeenCalledWith(MILANO_CENTRALE);
    expect(getStationByCode).toHaveBeenCalledWith(ROMA_TERMINI);
    expect(getOperatorByCode).toHaveBeenCalledWith('FS');
    expect(getTrainByCode).toHaveBeenCalledWith('ETR 400');

    const journey = result.journeys[0]!;
    expect(journey.datePrecision).toBe('month');
    expect(journey.departureScheduled).toBe('2024-06-14T09:45:00.000Z');
    expect(journey.arrivalScheduled).toBe('2024-06-14T12:58:00.000Z');
    expect(journey.departurePlatform).toBe('7');
    expect(journey.arrivalPlatform).toBe('12');
    expect(journey.passengers).toEqual([
      {
        ...seat,
        userId: 'local-user',
      },
    ]);
  });

  it('imports JSON exports with nested database IDs and no timetable fields', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      journeys: [
        {
          ...journeyBase,
          fromId: 10,
          toId: 11,
          operatorId: 12,
          trainId: 13,
          from: stationObject(MILANO_CENTRALE, 10),
          to: stationObject(ROMA_TERMINI, 11),
          operator: {
            id: 12,
            name: 'Trenitalia',
            code: 'FS',
          },
          train: {
            id: 13,
            name: 'Frecciarossa 1000',
            code: 'ETR 400',
          },
        },
      ],
    });

    const result = await processTrainTrailFile(content, baseOptions);

    expect(result.journeys).toHaveLength(1);
    expect(result.journeys[0]?.from).toMatchObject({ code: MILANO_CENTRALE });
    expect(result.journeys[0]?.to).toMatchObject({ code: ROMA_TERMINI });
    expect(result.journeys[0]?.datePrecision).toBe('day');
    expect(result.journeys[0]?.departureScheduled).toBeNull();
    expect(result.journeys[0]?.arrivalScheduled).toBeNull();
    expect(result.journeys[0]?.departurePlatform).toBeNull();
    expect(result.journeys[0]?.arrivalPlatform).toBeNull();
  });

  it('falls back to names when nested operator or train objects have no code', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      journeys: [
        {
          ...journeyBase,
          from: stationObject(MILANO_CENTRALE),
          to: stationObject(ROMA_TERMINI),
          operator: {
            name: 'Private Operator',
            code: null,
          },
          train: {
            name: 'Unknown Train',
            code: null,
          },
        },
      ],
    });

    const result = await processTrainTrailFile(content, baseOptions);

    expect(result.journeys).toHaveLength(1);
    expect(getOperatorByName).toHaveBeenCalledWith('Private Operator');
    expect(getTrainByName).toHaveBeenCalledWith('Unknown Train');
    expect(result.journeys[0]?.operator).toMatchObject({
      name: 'Private Operator',
    });
    expect(result.journeys[0]?.train).toMatchObject({
      name: 'Unknown Train',
    });
  });

  it('limits personal imports to the selected exported account', async () => {
    const otherUser = {
      id: 'export-other',
      username: 'jane',
      displayName: 'Jane Export',
    };
    userListQuery.mockResolvedValue([
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
      {
        id: 'local-other',
        username: 'jane',
        displayName: 'Jane Local',
      },
    ]);

    const content = JSON.stringify({
      users: [...exportedUsers, otherUser],
      journeys: [
        {
          ...journeyBase,
          from: stationObject(MILANO_CENTRALE),
          to: stationObject(ROMA_TERMINI),
          operator: null,
          train: null,
          passengers: [
            seat,
            {
              ...seat,
              userId: otherUser.id,
              seatNumber: '12B',
            },
          ],
        },
        {
          ...journeyBase,
          trainNumber: 'FR9618',
          from: stationObject(ROMA_TERMINI),
          to: stationObject(MILANO_CENTRALE),
          operator: null,
          train: null,
          passengers: [{ ...seat, userId: otherUser.id }],
        },
      ],
    });

    const result = await processTrainTrailFile(content, {
      ...baseOptions,
      userMapping: { 'export-user': 'local-user' },
    });

    expect(result.journeys).toHaveLength(1);
    expect(result.journeys[0]?.passengers).toEqual([
      { ...seat, userId: 'local-user' },
      {
        ...seat,
        userId: null,
        guestName: 'Jane Export',
        seatNumber: '12B',
      },
    ]);
    expect(userListQuery).not.toHaveBeenCalled();
  });

  it('restores mapped passengers without adding the importing admin', async () => {
    Object.assign(currentUser, {
      id: 'import-admin',
      username: 'admin',
      role: 'admin',
    });
    userListQuery.mockResolvedValue([
      {
        id: 'import-admin',
        username: 'admin',
        displayName: 'Import Admin',
      },
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
    ]);

    const content = JSON.stringify({
      users: exportedUsers,
      journeys: [
        {
          ...journeyBase,
          from: stationObject(MILANO_CENTRALE),
          to: stationObject(ROMA_TERMINI),
          operator: null,
          train: null,
        },
      ],
    });

    const result = await processTrainTrailFile(content, {
      ...baseOptions,
      importMode: 'restore',
      userMapping: { 'export-user': 'local-user' },
    });

    expect(result.journeys[0]?.passengers).toEqual([
      { ...seat, userId: 'local-user' },
    ]);
    expect(result.journeys[0]?.passengers).not.toContainEqual(
      expect.objectContaining({ userId: 'import-admin' }),
    );
    expect(userListQuery).toHaveBeenCalledOnce();
  });

  it('treats an explicit empty restore mapping as guest passengers', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      journeys: [
        {
          ...journeyBase,
          from: stationObject(MILANO_CENTRALE),
          to: stationObject(ROMA_TERMINI),
          operator: null,
          train: null,
        },
      ],
    });

    const result = await processTrainTrailFile(content, {
      ...baseOptions,
      importMode: 'restore',
      userMapping: {},
    });

    expect(result.journeys[0]?.passengers).toEqual([
      { ...seat, userId: null, guestName: 'John Export' },
    ]);
  });
});
