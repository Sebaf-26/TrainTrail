import type { Color } from '@deck.gl/core';

import type { Route } from '$lib/components/journey-filters/types';

import {
  getRouteKey,
  routeMatchesArc,
  type JourneyArc,
  type JourneyTrackPath,
} from './journey-layer-data';

export type RouteInteraction = {
  emphasis: 'normal' | 'primary' | 'secondary' | 'dimmed';
  opacity: number;
};

export type RouteInteractionContext = {
  hoveredArc?: JourneyArc | JourneyTrackPath;
  hoveredStationId?: number;
  selectedStationId: number | null;
  selectedRoute: Route | null;
};

const interaction = (
  emphasis: RouteInteraction['emphasis'],
  opacity = 255,
): RouteInteraction => ({ emphasis, opacity });

const arcsShareRoute = (left: JourneyArc, right: JourneyArc) =>
  getRouteKey(left.from.id, left.to.id) ===
  getRouteKey(right.from.id, right.to.id);

export const resolveRouteInteraction = (
  arc: JourneyArc,
  context: RouteInteractionContext,
): RouteInteraction => {
  const { hoveredArc, hoveredStationId, selectedStationId, selectedRoute } =
    context;
  const hoveredTrackJourneyId =
    hoveredArc && 'journeyId' in hoveredArc ? hoveredArc.journeyId : undefined;

  if (hoveredTrackJourneyId !== undefined) {
    if ('journeyId' in arc && arc.journeyId === hoveredTrackJourneyId) {
      return interaction('primary');
    }
    if (
      !('journeyId' in arc) &&
      hoveredArc &&
      arcsShareRoute(arc, hoveredArc)
    ) {
      return interaction('primary');
    }
    return hoveredArc && arcsShareRoute(arc, hoveredArc)
      ? interaction('secondary')
      : interaction('dimmed', 200);
  }

  if (
    (hoveredArc?.from === arc.from && hoveredArc?.to === arc.to) ||
    routeMatchesArc(arc, selectedRoute)
  ) {
    return interaction('primary');
  }
  if (hoveredArc) return interaction('dimmed', 200);
  if (hoveredStationId !== undefined) {
    return hoveredStationId === arc.from.id || hoveredStationId === arc.to.id
      ? interaction('normal')
      : interaction('dimmed', 200);
  }
  if (selectedStationId) {
    return selectedStationId === arc.from.id || selectedStationId === arc.to.id
      ? interaction('normal')
      : interaction('dimmed', 170);
  }
  return selectedRoute ? interaction('dimmed', 170) : interaction('normal');
};

const PRIMARY_COLOR: Color = [16, 185, 129];
const SECONDARY_COLOR: Color = [14, 165, 233];
const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];

export const applyJourneyTrackInteractionColor = (
  state: RouteInteraction,
  baseColor: Color,
): Color => {
  if (state.emphasis === 'primary') return PRIMARY_COLOR;
  if (state.emphasis === 'secondary') return SECONDARY_COLOR;
  if (state.emphasis === 'dimmed') return INACTIVE_COLOR(state.opacity);
  return baseColor;
};

export const getEstimatedTrackUnderlayColor = (
  state: RouteInteraction,
): Color => [
  0,
  0,
  0,
  state.emphasis === 'dimmed' ? Math.round(state.opacity * 0.3) : 176,
];

export const getGroundTrackCasingColor = (
  state: RouteInteraction,
  darkMode: boolean,
): Color => {
  const alpha =
    state.emphasis === 'dimmed' ? Math.round(state.opacity * 0.75) : 220;
  return darkMode ? [9, 9, 11, alpha] : [250, 250, 250, alpha];
};
