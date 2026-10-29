import { LngLat, type LngLatLike } from 'maplibre-gl';

export const distanceBetween = (a: LngLatLike, b: LngLatLike): number => {
  const from = LngLat.convert(a);
  const to = LngLat.convert(b);
  return from.distanceTo(to);
};

type Located = { lon: number; lat: number };

/**
 * The distance of a journey in km: along the rails when a route was computed
 * for it, otherwise the straight line between its stations.
 */
export const journeyDistanceKm = (journey: {
  from: Located | null;
  to: Located | null;
  railDistanceM?: number | null;
}): number | null => {
  if (journey.railDistanceM != null && journey.railDistanceM > 0) {
    return journey.railDistanceM / 1000;
  }
  return journey.from && journey.to
    ? distanceBetween(
        [journey.from.lon, journey.from.lat],
        [journey.to.lon, journey.to.lat],
      ) / 1000
    : null;
};

export const linearClamped = (
  distance: number,
  minDistance = 0,
  maxDistance = 15000,
  min = 1,
  max = 4,
): number => {
  // Ensure distance is within the bounds
  if (distance < minDistance) {
    distance = minDistance;
  } else if (distance > maxDistance) {
    distance = maxDistance;
  }

  // Linear mapping to the range [min, max]
  const value =
    min +
    ((distance - minDistance) / (maxDistance - minDistance)) * (max - min);
  return value;
};
