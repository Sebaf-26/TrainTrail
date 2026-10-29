import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}));

vi.mock('$env/dynamic/private', () => ({ env }));
vi.mock('$lib/db', () => ({ db: {} }));
vi.mock('$lib/db/queries', () => ({
  upsertJourneyTrackPrimitiveWithConnection: vi.fn(),
}));

import {
  fetchRailRoute,
  parseRailRoute,
  railRoutingReachable,
  resetRailRoutingHealth,
  trackMatchesStations,
} from './rail-route';

const TORINO = { lat: 45.061, lon: 7.67771 };
const GENOVA = { lat: 44.4153, lon: 8.9235 };

const response = (status: number, body: unknown = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe('parseRailRoute', () => {
  it('reads the coordinates and the length of the first path', () => {
    expect(
      parseRailRoute({
        paths: [
          {
            distance: 169_400.5,
            points: {
              coordinates: [
                [7.6777, 45.061],
                [8.9235, 44.4153],
              ],
            },
          },
        ],
      }),
    ).toEqual({
      coordinates: [
        [7.6777, 45.061],
        [8.9235, 44.4153],
      ],
      distance: 169_400.5,
    });
  });

  it.each([
    ['no path', { paths: [] }],
    ['an encoded polyline', { paths: [{ points: 'abc123' }] }],
    ['a single point', { paths: [{ points: { coordinates: [[1, 2]] } }] }],
    [
      'a malformed point',
      {
        paths: [
          {
            points: {
              coordinates: [
                [1, 2],
                ['x', 3],
              ],
            },
          },
        ],
      },
    ],
    ['nothing', null],
  ])('gives no route for %s', (_, body) => {
    expect(parseRailRoute(body)).toBeNull();
  });
});

describe('fetchRailRoute', () => {
  const body = {
    paths: [
      {
        distance: 10,
        points: {
          coordinates: [
            [1, 2],
            [3, 4],
          ],
        },
      },
    ],
  };

  it('asks for the rail profile with plain coordinates, longitude first', async () => {
    const fetchImpl = vi.fn(async () => response(200, body));

    const route = await fetchRailRoute(
      'http://rail-routing:8989',
      TORINO,
      GENOVA,
      fetchImpl as unknown as typeof fetch,
    );

    expect(route?.coordinates).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://rail-routing:8989/route');
    expect(JSON.parse(init.body as string)).toEqual({
      points: [
        [7.67771, 45.061],
        [8.9235, 44.4153],
      ],
      profile: 'rail',
      points_encoded: false,
    });
  });

  it('treats a 400 as "no route", not as a failure', async () => {
    const fetchImpl = vi.fn(async () => response(400, { message: 'no way' }));

    await expect(
      fetchRailRoute('http://x', TORINO, GENOVA, fetchImpl as never),
    ).resolves.toBeNull();
  });

  it('throws when the service itself fails', async () => {
    const fetchImpl = vi.fn(async () => response(500));

    await expect(
      fetchRailRoute('http://x', TORINO, GENOVA, fetchImpl as never),
    ).rejects.toThrow('answered 500');
  });
});

describe('trackMatchesStations', () => {
  it('accepts a track that starts and ends at the stations', () => {
    expect(
      trackMatchesStations(
        [
          [7.678, 45.0615],
          [8.0, 44.9],
          [8.9231, 44.4157],
        ],
        TORINO,
        GENOVA,
      ),
    ).toBe(true);
  });

  it('rejects a track whose end moved away from the arrival station', () => {
    expect(
      trackMatchesStations(
        [
          [7.678, 45.0615],
          [9.19, 45.4871],
        ],
        TORINO,
        GENOVA,
      ),
    ).toBe(false);
  });

  it('rejects an empty track', () => {
    expect(trackMatchesStations([], TORINO, GENOVA)).toBe(false);
  });
});

describe('railRoutingReachable', () => {
  const answering = (status: number) =>
    vi.fn(async () => response(status)) as unknown as typeof fetch;

  beforeEach(() => {
    resetRailRoutingHealth();
    env.RAIL_ROUTING_URL = 'http://rail-routing:8989/';
  });

  it('is false, without asking anyone, when no service is set up', async () => {
    env.RAIL_ROUTING_URL = undefined;
    const fetchImpl = answering(200);

    await expect(railRoutingReachable(fetchImpl)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is true when the health check answers', async () => {
    const fetchImpl = answering(200);

    await expect(railRoutingReachable(fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://rail-routing:8989/health',
      expect.anything(),
    );
  });

  it('is false when it answers with an error or does not answer', async () => {
    await expect(railRoutingReachable(answering(503))).resolves.toBe(false);

    resetRailRoutingHealth();
    const down = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND rail-routing');
    }) as unknown as typeof fetch;
    await expect(railRoutingReachable(down)).resolves.toBe(false);
  });

  it('remembers the answer for a short while', async () => {
    const fetchImpl = answering(200);
    let time = 1_000;

    await railRoutingReachable(fetchImpl, () => time);
    time += 10_000;
    await railRoutingReachable(fetchImpl, () => time);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    time += 40_000;
    await railRoutingReachable(fetchImpl, () => time);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
