import { env } from '$env/dynamic/private';
import { db } from '$lib/db';
import { upsertJourneyTrackPrimitiveWithConnection } from '$lib/db/queries';
import type { JourneyTrackCoordinate } from '$lib/track/schema';

/**
 * Real rail routes. The route between two stations is asked of an
 * OpenRailRouting service (optional, see docker-compose.yml) and stored as the
 * journey's track, so the map draws it like any recorded track. Without the
 * service, or when it cannot find a route, the journey keeps its straight line.
 */

type Point = { lat: number; lon: number };

/**
 * Everything the feature does is logged with the `[rail-routing]` prefix, with
 * the details needed to see why a route was or was not drawn: grep for it in
 * the container logs.
 */
const log = (
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>,
) =>
  console[level](
    `[rail-routing] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`,
  );

const excerpt = (text: string, max = 300) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

let configLogged = false;
const logConfigOnce = (baseUrl: string | null) => {
  if (configLogged) return;
  configLogged = true;
  log(
    'info',
    baseUrl
      ? `service configured at ${baseUrl}`
      : 'no service configured (RAIL_ROUTING_URL is empty): journeys keep the straight line',
  );
};

export type RailRoute = {
  coordinates: [number, number][];
  /** Length of the route along the rails, in metres. */
  distance: number;
};

export type DrawRouteResult =
  | { status: 'drawn' | 'kept' | 'none' }
  | { status: 'unavailable'; message: string };

/** The track points can sit this far from the station coordinates. */
const ENDPOINT_TOLERANCE_KM = 3;
const REQUEST_TIMEOUT_MS = 20_000;

export const railRoutingUrl = () => {
  const url = env.RAIL_ROUTING_URL?.trim().replace(/\/+$/, '');
  return url ? url : null;
};

const HEALTH_TIMEOUT_MS = 2_000;
const HEALTH_CACHE_MS = 30_000;
let health: { at: number; ok: boolean } | null = null;
let lastHealthOk: boolean | null = null;

/**
 * Whether the routing service is set up and answering. Cached for a short
 * while, so the journey panel does not probe it every time it opens.
 */
export const railRoutingReachable = async (
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
) => {
  const baseUrl = railRoutingUrl();
  if (!baseUrl) {
    return false;
  }
  if (health && now() - health.at < HEALTH_CACHE_MS) {
    return health.ok;
  }

  logConfigOnce(baseUrl);
  let ok = false;
  let reason = '';
  try {
    const response = await fetchImpl(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    ok = response.ok;
    reason = `HTTP ${response.status}`;
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }
  // Only changes are logged, so a service that stays down is not repeated.
  if (ok !== lastHealthOk) {
    lastHealthOk = ok;
    log(
      ok ? 'info' : 'warn',
      `health check of ${baseUrl}/health: ${ok ? 'service is up' : 'service is NOT answering'}`,
      { reason },
    );
  }
  health = { at: now(), ok };
  return ok;
};

/** For tests: forgets the cached answer of `railRoutingReachable`. */
export const resetRailRoutingHealth = () => {
  health = null;
  lastHealthOk = null;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceKm = (a: Point, b: Point) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** The route out of a GraphHopper `/route` response, or null if it has none. */
export const parseRailRoute = (body: unknown): RailRoute | null => {
  const path = (body as { paths?: unknown[] } | null)?.paths?.[0] as
    | {
        distance?: unknown;
        points?: { coordinates?: unknown };
      }
    | undefined;
  const raw = path?.points?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) {
    return null;
  }

  const coordinates: [number, number][] = [];
  for (const point of raw) {
    if (
      !Array.isArray(point) ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number'
    ) {
      return null;
    }
    coordinates.push([point[0], point[1]]);
  }

  return {
    coordinates,
    distance: typeof path?.distance === 'number' ? path.distance : 0,
  };
};

export const fetchRailRoute = async (
  baseUrl: string,
  from: Point,
  to: Point,
  fetchImpl: typeof fetch = fetch,
): Promise<RailRoute | null> => {
  const started = Date.now();
  const response = await fetchImpl(`${baseUrl}/route`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      points: [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ],
      profile: 'rail',
      points_encoded: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const elapsedMs = Date.now() - started;

  // A 400 is the engine saying there is no route (a point far from any track,
  // or two points that are not connected): not a failure of the service.
  if (response.status === 400) {
    const text = await response.text().catch(() => '');
    log('info', 'the engine found no route (HTTP 400)', {
      from,
      to,
      elapsedMs,
      answer: excerpt(text),
    });
    return null;
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    log('error', `the engine answered HTTP ${response.status}`, {
      elapsedMs,
      answer: excerpt(text),
    });
    throw new Error(`The routing service answered ${response.status}`);
  }

  const body = await response.json();
  const route = parseRailRoute(body);
  if (!route) {
    log('warn', 'the answer has no usable route', {
      elapsedMs,
      answer: excerpt(JSON.stringify(body)),
    });
    return null;
  }
  log('info', 'route received', {
    elapsedMs,
    points: route.coordinates.length,
    distanceKm: Math.round(route.distance / 100) / 10,
  });
  return route;
};

/** True when a stored track still starts and ends at the journey's stations. */
export const trackMatchesStations = (
  coordinates: readonly JourneyTrackCoordinate[],
  from: Point,
  to: Point,
) => {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last) {
    return false;
  }
  return (
    distanceKm({ lon: first[0], lat: first[1] }, from) <=
      ENDPOINT_TOLERANCE_KM &&
    distanceKm({ lon: last[0], lat: last[1] }, to) <= ENDPOINT_TOLERANCE_KM
  );
};

/** The message of an error with the reason it carries (fetch hides it in `cause`). */
const describeError = (error: unknown) => {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  const detail =
    cause instanceof Error ? cause.message : cause ? String(cause) : '';
  return detail ? `${error.message} (${detail})` : error.message;
};

/**
 * Draws a journey along the rails. A track that is not a computed route (a
 * recorded GPX, say) is never replaced, and a computed route that still fits
 * the stations is kept.
 */
export const drawJourneyRoute = async (
  journeyId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<DrawRouteResult> => {
  const baseUrl = railRoutingUrl();
  logConfigOnce(baseUrl);
  if (!baseUrl) {
    return {
      status: 'unavailable',
      message: 'Rail routing is not set up on this server.',
    };
  }

  const journey = await db
    .selectFrom('journey')
    .innerJoin('station as from', 'from.id', 'journey.fromId')
    .innerJoin('station as to', 'to.id', 'journey.toId')
    .select([
      'from.name as fromName',
      'from.lat as fromLat',
      'from.lon as fromLon',
      'to.name as toName',
      'to.lat as toLat',
      'to.lon as toLon',
    ])
    .where('journey.id', '=', journeyId)
    .executeTakeFirst();
  if (!journey) {
    log('info', `journey ${journeyId}: not drawn, it has no two stations`);
    return { status: 'kept' };
  }
  const from = { lat: journey.fromLat, lon: journey.fromLon };
  const to = { lat: journey.toLat, lon: journey.toLon };
  const label = `journey ${journeyId} (${journey.fromName} → ${journey.toName})`;

  const stored = await db
    .selectFrom('journeyTrack')
    .select(['track', 'sourceFormat'])
    .where('journeyId', '=', journeyId)
    .executeTakeFirst();
  if (stored) {
    if (stored.sourceFormat !== 'rail') {
      log(
        'info',
        `${label}: kept, it already has a ${stored.sourceFormat} track`,
      );
      return { status: 'kept' };
    }
    const coordinates = (
      stored.track as { coordinates?: JourneyTrackCoordinate[] }
    ).coordinates;
    if (coordinates && trackMatchesStations(coordinates, from, to)) {
      log('info', `${label}: kept, its route still fits the stations`);
      return { status: 'kept' };
    }
    log('info', `${label}: its route no longer fits the stations, redrawing`);
  }

  log('info', `${label}: asking for a route`, { from, to });
  let route: RailRoute | null;
  try {
    route = await fetchRailRoute(baseUrl, from, to, fetchImpl);
  } catch (error) {
    const message = describeError(error);
    log('warn', `${label}: the service failed`, { baseUrl, message });
    return { status: 'unavailable', message };
  }
  if (!route) {
    log('info', `${label}: no route, the straight line stays`);
    return { status: 'none' };
  }

  await upsertJourneyTrackPrimitiveWithConnection(db, journeyId, {
    coordinates: route.coordinates,
    sourceFormat: 'rail',
    sourceName: 'OpenRailRouting',
  });
  log(
    'info',
    `${label}: drawn along the rails (${route.coordinates.length} points)`,
  );
  return { status: 'drawn' };
};

/**
 * Draws journeys along the rails in the background, a couple at a time. It
 * never throws and does nothing when the service is not set up, so saving a
 * journey does not wait for, or depend on, the routing service.
 */
export const scheduleRailRoutes = (journeyIds: readonly number[]) => {
  const baseUrl = railRoutingUrl();
  logConfigOnce(baseUrl);
  if (!baseUrl || journeyIds.length === 0) {
    return;
  }

  log('info', `queued ${journeyIds.length} journey(s)`, { ids: journeyIds });
  const queue = [...journeyIds];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const result = await drawJourneyRoute(id);
        if (result.status === 'unavailable') {
          // The service is down or not reachable: skip the rest of the batch.
          const skipped = queue.length;
          queue.length = 0;
          if (skipped > 0) {
            log('warn', `skipping the ${skipped} remaining journey(s)`);
          }
        }
      } catch (error) {
        log('error', `could not draw the route of journey ${id}`, {
          message: describeError(error),
        });
      }
    }
  };
  void Promise.all([worker(), worker()]);
};
