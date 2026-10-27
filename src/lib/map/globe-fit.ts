import type { Station } from '$lib/db/types';

type Vec3 = [number, number, number];
type WeightedStation = { vector: Vec3; weight: number };

export type GlobeFitArc = {
  from: Station;
  to: Station;
  frequency?: number;
};

export type GlobeFitViewport = {
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
};

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

// MapLibre's default vertical field of view (transform._fovInRadians); the
// camera sits at 0.5 * height / tan(fov / 2) pixels from the map center.
const FOV_TAN_HALF = Math.tan(0.6435011087932844 / 2);
// Past this cap radius no single globe view can contain every station (the
// visible rim sits at ~70° from the view center at whole-disc zoom), so the
// view becomes a planet overview centered on where the user travels most.
const FULL_VIEW_RADIUS = 70 * DEGREES_TO_RADIANS;
// Keeps the zoom finite when every journey touches a single station.
const MIN_CAP_RADIUS = 0.5 * DEGREES_TO_RADIANS;

const toUnitVector = (station: Station): Vec3 => {
  const lat = station.lat * DEGREES_TO_RADIANS;
  const lon = station.lon * DEGREES_TO_RADIANS;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
};

const normalize = (v: Vec3): Vec3 | undefined => {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-9) return undefined;
  return [v[0] / length, v[1] / length, v[2] / length];
};

const angleBetween = (a: Vec3, b: Vec3) =>
  Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

const collectStations = (data: GlobeFitArc[]): WeightedStation[] => {
  const byId = new Map<number, WeightedStation>();
  for (const arc of data) {
    const weight = arc.frequency ?? 1;
    for (const station of [arc.from, arc.to]) {
      const existing = byId.get(station.id);
      if (existing) {
        existing.weight += weight;
      } else {
        byId.set(station.id, { vector: toUnitVector(station), weight });
      }
    }
  }
  return [...byId.values()];
};

const meanDirection = (
  stations: WeightedStation[],
  weighted: boolean,
): Vec3 | undefined => {
  const sum: Vec3 = [0, 0, 0];
  for (const { vector, weight } of stations) {
    const w = weighted ? weight : 1;
    sum[0] += vector[0] * w;
    sum[1] += vector[1] * w;
    sum[2] += vector[2] * w;
  }
  return normalize(sum);
};

const capRadius = (center: Vec3, stations: WeightedStation[]) => {
  let radius = 0;
  for (const { vector } of stations) {
    radius = Math.max(radius, angleBetween(center, vector));
  }
  return radius;
};

// Smallest-ish spherical cap containing every arc endpoint: centered on the
// normalized mean of the stations' unit vectors, radius the max angular
// distance to any of them. Every point of a great-circle arc lies within
// the cap of its endpoints, so covering the stations covers the routes.
const sphericalCapForArcs = (data: GlobeFitArc[]) => {
  const stations = collectStations(data);
  if (!stations.length) return undefined;

  // A perfectly balanced antipodal spread has no mean direction; any
  // station is then as good a center as any other.
  let center = meanDirection(stations, false) ?? stations[0]!.vector;
  let radius = capRadius(center, stations);

  if (radius > FULL_VIEW_RADIUS) {
    // No single view exists, so only the choice of hemisphere matters:
    // bias it toward the stations with the most journeys.
    const weightedCenter = meanDirection(stations, true);
    if (weightedCenter) {
      center = weightedCenter;
      radius = capRadius(center, stations);
    }
  }

  return { center, radius: Math.max(radius, MIN_CAP_RADIUS) };
};

/**
 * Camera (center + zoom) that best shows the given arcs on the MapLibre
 * globe. When everything fits a single view this is an exact fit, like
 * fitBounds; when the arcs span more than a visible hemisphere it degrades
 * to a whole-planet view centered on the journey-frequency-weighted centroid
 * (a bounding-box fitBounds silently fails in that case).
 *
 * The returned center is the raw cap center: pass the same padding to
 * easeTo/flyTo (or set it persistently) so the camera places it at the
 * padded viewport center.
 */
export const globeCameraForArcs = (
  data: GlobeFitArc[],
  viewport: GlobeFitViewport,
): { center: [number, number]; zoom: number } | undefined => {
  const cap = sphericalCapForArcs(data);
  if (!cap) return undefined;

  const { width, height, padding } = viewport;
  if (!(width > 0) || !(height > 0)) return undefined;
  const available = Math.min(
    width - padding.left - padding.right,
    height - padding.top - padding.bottom,
  );
  // Degenerate viewports (padding exceeding the screen) still deserve a
  // sensible view rather than a dead control.
  const halfExtent = Math.max(available, 80) / 2;
  const focalLength = (0.5 * height) / FOV_TAN_HALF;

  // Globe pixel radius at which the cap rim spans the available viewport
  // (screen radius of the rim: focal * R*sin(θ) / (focal + R - R*cos(θ))).
  // The rim equation only holds while the rim is in front of the horizon —
  // past FULL_VIEW_RADIUS it turns around and zooms back in — so wider caps
  // frame the whole disc instead.
  const sin = Math.sin(cap.radius);
  const cos = Math.cos(cap.radius);
  const fitDenominator = focalLength * sin + halfExtent * (cos - 1);
  const globeRadius =
    cap.radius < FULL_VIEW_RADIUS && fitDenominator > 0
      ? (halfExtent * focalLength) / fitDenominator
      : (halfExtent * halfExtent +
          halfExtent * Math.hypot(halfExtent, focalLength)) /
        focalLength;

  const lat =
    Math.asin(Math.max(-1, Math.min(1, cap.center[2]))) * RADIANS_TO_DEGREES;
  const lng = Math.atan2(cap.center[1], cap.center[0]) * RADIANS_TO_DEGREES;
  // MapLibre's getGlobeRadiusPixels: radius = worldSize / 2π / cos(lat),
  // with worldSize = 512 * 2^zoom.
  const zoom = Math.log2(
    (globeRadius * 2 * Math.PI * Math.cos(lat * DEGREES_TO_RADIANS)) / 512,
  );

  return { center: [lng, lat], zoom };
};
