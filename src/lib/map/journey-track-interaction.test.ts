import { describe, expect, it } from 'vitest';

import type { JourneyArc, JourneyTrackPath } from './journey-layer-data';
import {
  applyJourneyTrackInteractionColor,
  getEstimatedTrackUnderlayColor,
  resolveRouteInteraction,
  type RouteInteractionContext,
} from './journey-track-interaction';

const station = (id: number) => ({ id });
const arc = (fromId: number, toId: number) =>
  ({ from: station(fromId), to: station(toId) }) as JourneyArc;
const track = (journeyId: number, fromId: number, toId: number) =>
  ({ ...arc(fromId, toId), journeyId, samples: [] }) as JourneyTrackPath;
const context = (
  overrides: Partial<RouteInteractionContext> = {},
): RouteInteractionContext => ({
  selectedStationId: null,
  selectedRoute: null,
  ...overrides,
});

describe('journey track interaction', () => {
  it('distinguishes the hovered track from other tracks on its route', () => {
    const hoveredArc = track(10, 1, 2);

    expect(
      resolveRouteInteraction(hoveredArc, context({ hoveredArc })),
    ).toEqual({ emphasis: 'primary', opacity: 255 });
    expect(
      resolveRouteInteraction(track(11, 2, 1), context({ hoveredArc })),
    ).toEqual({ emphasis: 'secondary', opacity: 255 });
    expect(
      resolveRouteInteraction(track(12, 3, 4), context({ hoveredArc })),
    ).toEqual({ emphasis: 'dimmed', opacity: 200 });
    expect(resolveRouteInteraction(arc(1, 2), context({ hoveredArc }))).toEqual(
      { emphasis: 'primary', opacity: 255 },
    );
  });

  it('uses explicit opacity for selected-route dimming', () => {
    const state = resolveRouteInteraction(
      arc(3, 4),
      context({ selectedRoute: { a: '1', b: '2' } }),
    );

    expect(state).toEqual({ emphasis: 'dimmed', opacity: 170 });
    expect(applyJourneyTrackInteractionColor(state, [1, 2, 3])).toEqual([
      113, 113, 122, 170,
    ]);
    expect(getEstimatedTrackUnderlayColor(state)).toEqual([0, 0, 0, 51]);
  });
});
