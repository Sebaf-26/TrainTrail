<script lang="ts">
  import type { Color, Layer, PickingInfo, Position } from '@deck.gl/core';
  import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
  import { MapLibreOverlay } from '@deck.gl/maplibre';
  import { isTouchDevice } from '@melt-ui/svelte/internal/helpers';
  import { mode } from 'mode-watcher';
  import { onDestroy } from 'svelte';
  import {
    Box,
    getId,
    getMapContext,
    setPopupTarget,
    updatedDeckGlContext,
    Popup,
  } from 'svelte-maplibre';

  import { StationPopup, ArcPopup } from '.';

  import {
    normalizeRoute,
    type TempFilters,
  } from '$lib/components/journey-filters/types';
  import type { NavigateJourneys } from '$lib/journey-navigation';
  import {
    buildArcFrequencyPercentileByRoute,
    buildJourneyTrackPaths,
    findFullyTrackedRouteKeys,
    getRouteKey,
    routeMatchesArc,
    type JourneyArc,
    type JourneyTrackPath,
  } from '$lib/map/journey-layer-data';
  import {
    applyJourneyTrackInteractionColor,
    getEstimatedTrackUnderlayColor,
    getGroundTrackCasingColor,
    resolveRouteInteraction,
  } from '$lib/map/journey-track-interaction';
  import {
    buildJourneyTrackLayers,
    prepareJourneyTrackLayerData,
  } from '$lib/map/journey-track-layers';
  import {
    getJourneyTrackColor,
    type JourneyTrackRun,
  } from '$lib/map/journey-track-style';
  import { GlobeOcclusionExtension } from '$lib/map/globe-occlusion';
  import {
    createPopupPositionController,
    getDeckPointerLngLat,
    getDeckPointerPixel,
    type DeckPointerEvent,
  } from '$lib/map/map-popup-position';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import { PreciseArcEndpointsExtension } from '$lib/map/precise-arc-endpoints';
  import {
    closeMapDetails,
    mapDetailsState,
    openStationDetails,
    openJourneyDetails,
    openRouteDetails,
  } from '$lib/state.svelte';
  import type { JourneyTrackRow } from '$lib/track/schema';
  import { type JourneyData, prepareVisitedStations } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const STATION_COLOR = (alpha: number): Color => [16, 185, 129, alpha]; // Tailwind emerald-500
  const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];
  const FROM_COLOR = [59, 130, 246] as const; // Also the primary color
  const TO_COLOR = [139, 92, 246] as const; // TW violet-500
  const HIGH_FREQUENCY_COLOR = [239, 68, 68] as const; // TW red-500
  const FUTURE_COLOR: Color = [102, 217, 239, 100];

  const MERCATOR_ROUTE_PARAMETERS = {
    cullMode: 'none',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const MERCATOR_STATION_PARAMETERS = {
    cullMode: 'back',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;

  // In globe mode deck shares MapLibre's depth buffer but reconstructs its
  // own globe projection, so surface geometry can never depth-test cleanly
  // against the basemap globe (z-fighting). Depth is skipped entirely and
  // GlobeOcclusionExtension hides the far side of the globe instead.
  const GLOBE_ARC_PARAMETERS = {
    // Arc ribbons are extruded in screen space, so their winding is
    // unreliable on the globe — never cull them.
    cullMode: 'none',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const GLOBE_STATION_PARAMETERS = {
    cullMode: 'back',
    depthCompare: 'always',
    depthWriteEnabled: false,
  } as const;
  const globeOcclusion = new GlobeOcclusionExtension();
  const preciseArcEndpoints = new PreciseArcEndpointsExtension();
  const isDarkMode = $derived(mode.current === 'dark');

  const interpolateColor = (
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    t: number,
  ): Color => {
    const clampedT = Math.max(0, Math.min(1, t));
    return [
      Math.round(from[0] + (to[0] - from[0]) * clampedT),
      Math.round(from[1] + (to[1] - from[1]) * clampedT),
      Math.round(from[2] + (to[2] - from[2]) * clampedT),
    ];
  };
  let {
    journeys,
    journeyArcs,
    journeyTracks = [],
    tempFilters = $bindable(),
    onNavigate,
  }: {
    journeys: JourneyData[];
    journeyArcs: JourneyArc[];
    journeyTracks?: JourneyTrackRow[];
    tempFilters?: TempFilters;
    onNavigate?: NavigateJourneys;
  } = $props();

  const visitedStations = $derived.by(() => {
    const data = journeys;
    if (!data || !data.length) return [];

    return prepareVisitedStations(data);
  });

  type VisitedStation = (typeof visitedStations)[0];
  const arcFrequencyPercentileByRoute = $derived.by(() => {
    return buildArcFrequencyPercentileByRoute(journeyArcs);
  });

  const getArcFrequencyPercentile = (d: JourneyArc) => {
    const routeKey = getRouteKey(d.from.id, d.to.id);
    return arcFrequencyPercentileByRoute[routeKey] ?? 0;
  };

  const activeJourneyTracks = $derived.by(() => {
    if (mapPreferences.routeDisplay !== 'tracks') return [];
    return journeyTracks;
  });

  const trackJourneyIds = $derived.by(() => {
    return new Set(activeJourneyTracks.map((track) => track.journeyId));
  });

  const fullyTrackedRouteKeys = $derived.by(() => {
    return findFullyTrackedRouteKeys(journeyArcs, trackJourneyIds);
  });

  const visibleJourneyArcs = $derived.by(() => {
    return journeyArcs.filter(
      (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
    );
  });

  const journeyTrackPaths = $derived.by(() => {
    return buildJourneyTrackPaths(journeys, journeyArcs, activeJourneyTracks);
  });

  const journeyById = $derived.by(() => {
    return new Map(journeys.map((journey) => [journey.id, journey]));
  });

  const journeyTrackLayerData = $derived.by(() =>
    prepareJourneyTrackLayerData(
      journeyTrackPaths,
      mapPreferences.journeyTrackStyle,
    ),
  );

  let id = getId('deckgl-layer');
  let hoveredStation: VisitedStation | undefined = $state.raw(undefined);
  let hoveredArc: JourneyArc | JourneyTrackPath | undefined =
    $state.raw(undefined);
  const clickable = $derived(tempFilters !== undefined);

  const context = getMapContext();
  const { map, loaded } = $derived(context);
  const popupPosition = createPopupPositionController(() => map);

  const { layer: layerId, layerEvent } = updatedDeckGlContext();
  layerId.value = id;
  setPopupTarget(new Box(undefined));

  const getProjectionType = () => {
    const projection = map?.getProjection?.() as
      { type?: string; name?: string } | undefined;
    return projection?.type ?? projection?.name ?? 'unknown';
  };

  const handleStationHover = (
    e: PickingInfo<VisitedStation>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      mapDetailsState.hoveredJourneyTrackId = null;
      hoveredStation = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleArcHover = (
    e: PickingInfo<JourneyArc>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      mapDetailsState.hoveredJourneyTrackId = null;
      hoveredArc = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleTrackHover = (
    e: PickingInfo<JourneyTrackPath>,
    event?: DeckPointerEvent,
  ) => {
    if (!isTouchDevice()) {
      mapDetailsState.hoveredJourneyTrackId = e.object?.journeyId ?? null;
      hoveredArc = e.object ?? undefined;
      popupPosition.update(getDeckPointerPixel(e, event));
      const type = e.index !== -1 ? 'mousemove' : 'mouseleave';
      layerEvent.value = {
        ...e,
        coordinate: getDeckPointerLngLat(e, event, map),
        layerType: 'deckgl',
        type,
      };
    }
  };

  const handleStationClick = (e: PickingInfo<VisitedStation>) => {
    if (e.object && tempFilters) {
      openStationDetails(e.object.id);
    }
  };

  const handleArcClick = (e: PickingInfo<JourneyArc>) => {
    if (!e.object || !tempFilters) return;
    const route = normalizeRoute(
      e.object.from.id.toString(),
      e.object.to.id.toString(),
    );
    // While this route's pane is open, clicking its point-to-point line opens
    // the journey list drilled down to the whole route; otherwise open (or
    // switch to) that route's details.
    if (selectedRoute && routeMatchesArc(e.object, selectedRoute)) {
      onNavigate?.({
        destination: 'list',
        focus: { type: 'route', route },
      });
    } else {
      openRouteDetails(route);
    }
  };

  const handleTrackClick = (e: PickingInfo<JourneyTrackPath>) => {
    if (!e.object || !tempFilters) return;
    // While this route's pane is open, clicking a specific journey's track opens
    // its Journey Details pane (same as clicking the journey in the route pane) —
    // which isolates that journey on the map for as long as the pane is open;
    // otherwise open the route details.
    if (selectedRoute && routeMatchesArc(e.object, selectedRoute)) {
      openJourneyDetails(e.object.journeyId);
    } else {
      openRouteDetails(
        normalizeRoute(e.object.from.id.toString(), e.object.to.id.toString()),
      );
    }
  };

  const handleMapClick = (e: PickingInfo) => {
    if (!e.object && mapDetailsState.selection) {
      closeMapDetails();
    }
  };

  let layer: MapLibreOverlay | undefined = $state();
  let layerProjection: string | undefined = $state(undefined);
  let currentMapProjection = $state('unknown');
  const isGlobe = $derived(mapPreferences.projection === 'globe');

  onDestroy(() => {
    mapDetailsState.hoveredJourneyTrackId = null;
    if (loaded && layer && map) {
      map.removeControl(layer);
    }
  });

  $effect(() => {
    layerId.value = id;
  });

  // The deck overlay must match the basemap's actual projection, which lags
  // the preference while MapLibre transitions between projections.
  $effect(() => {
    if (!map) return;

    const syncMapProjection = () => {
      currentMapProjection = getProjectionType();
    };
    const projectionEvents = map as unknown as {
      on(event: 'projectiontransition', listener: () => void): void;
      off(event: 'projectiontransition', listener: () => void): void;
    };

    syncMapProjection();
    projectionEvents.on('projectiontransition', syncMapProjection);
    map.on('styledata', syncMapProjection);

    return () => {
      projectionEvents.off('projectiontransition', syncMapProjection);
      map.off('styledata', syncMapProjection);
    };
  });

  const selectedStationId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'station' ? selection.stationId : null;
  });

  const selectedJourneyId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'journey' ? selection.journeyId : null;
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  // Hovering a journey row in the route pane sets mapDetailsState.hoveredJourneyTrackId
  // but no map hover. Synthesise a hovered arc/track for that journey so the map
  // highlights its line the same way a direct map hover would.
  const effectiveHoveredArc = $derived.by(() => {
    if (hoveredArc) return hoveredArc;
    const id = mapDetailsState.hoveredJourneyTrackId;
    if (id == null) return undefined;
    const journey = journeyById.get(id);
    if (!journey?.from || !journey.to) return undefined;
    const route = normalizeRoute(
      journey.from.id.toString(),
      journey.to.id.toString(),
    );
    const arc = journeyArcs.find((candidate) =>
      routeMatchesArc(candidate, route),
    );
    if (!arc) return undefined;
    // A tracked journey is emphasised via its track (carries journeyId); a
    // point-to-point journey is emphasised via its route's straight arc.
    return trackJourneyIds.has(id) ? { ...arc, journeyId: id } : arc;
  });

  const selectedRouteStationIds = $derived.by(() => {
    if (!selectedRoute) return [];
    return [Number(selectedRoute.a), Number(selectedRoute.b)];
  });
  const getStationFillColor = () => {
    return (station: (typeof visitedStations)[number]): Color => {
      if (selectedStationId === station.id) {
        return STATION_COLOR(110);
      } else if (selectedRouteStationIds.includes(station.id)) {
        return STATION_COLOR(85);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(45);
      } else if (hoveredStation == station) {
        return STATION_COLOR(80);
      } else if (
        hoveredStation?.journeys.some((f) => f.stations.includes(station.id))
      ) {
        return STATION_COLOR(50);
      } else if (
        hoveredArc?.from.id === station.id ||
        hoveredArc?.to.id === station.id
      ) {
        return STATION_COLOR(50);
      } else if (hoveredArc) {
        return INACTIVE_COLOR(50);
      } else if (hoveredStation) {
        return INACTIVE_COLOR(50);
      } else {
        return STATION_COLOR(50);
      }
    };
  };

  const getStationLineColor = () => {
    return (station: (typeof visitedStations)[number]): Color => {
      if (selectedStationId === station.id) {
        return STATION_COLOR(255);
      } else if (selectedRouteStationIds.includes(station.id)) {
        return STATION_COLOR(255);
      } else if (selectedRoute) {
        return INACTIVE_COLOR(230);
      } else if (
        hoveredStation?.id === station.id ||
        hoveredStation?.journeys.some((f) => f.stations.includes(station.id))
      ) {
        return STATION_COLOR(255);
      } else if (hoveredStation) {
        return INACTIVE_COLOR(255);
      } else if (
        hoveredArc?.from.id === station.id ||
        hoveredArc?.to.id === station.id
      ) {
        return STATION_COLOR(255);
      } else if (hoveredArc) {
        return INACTIVE_COLOR(255);
      } else {
        return STATION_COLOR(255);
      }
    };
  };

  const getBaseArcColor = (point: 'source' | 'target') => {
    return (d: JourneyArc): Color => {
      if (d.exclusivelyFuture) {
        return FUTURE_COLOR;
      }
      if (mapPreferences.arcColor === 'byFrequency') {
        const normalizedFreq = getArcFrequencyPercentile(d);
        const baseColor = point === 'source' ? FROM_COLOR : TO_COLOR;
        return interpolateColor(
          baseColor,
          HIGH_FREQUENCY_COLOR,
          normalizedFreq,
        );
      }
      return point === 'source' ? FROM_COLOR : TO_COLOR;
    };
  };

  const getArcColor = (point: 'source' | 'target') => {
    const baseArcColor = getBaseArcColor(point);

    return (arc: (typeof journeyArcs)[number]) =>
      applyJourneyTrackInteractionColor(
        getRouteInteraction(arc),
        baseArcColor(arc),
      );
  };

  const STATION_CIRCLE_SIZE = {
    small: { scale: 0.4, maxPixels: 45 },
    medium: { scale: 0.7, maxPixels: 70 },
    large: { scale: 1, maxPixels: 100 },
  } as const;

  const UNIFORM_ARC_WIDTH = {
    thin: 1,
    normal: 2,
    thick: 4,
  } as const;

  const FREQUENCY_ARC_MULTIPLIER = {
    thin: 0.8,
    normal: 1.5,
    thick: 2.5,
  } as const;
  const UNIFORM_STATION_FREQUENCY = 2;

  const getArcWidth = (d: JourneyArc) => {
    if (mapPreferences.arcThickness === 'byFrequency') {
      const normalizedFreq = getArcFrequencyPercentile(d);
      const scaledFreq = 1 + normalizedFreq * 2;
      return (
        scaledFreq * FREQUENCY_ARC_MULTIPLIER[mapPreferences.arcThicknessScale]
      );
    }
    return UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
  };

  const getVisibleArcWidth = (d: JourneyArc) => {
    const width =
      selectedJourneyId === null
        ? getArcWidth(d)
        : UNIFORM_ARC_WIDTH[mapPreferences.arcThicknessScale];
    return routeMatchesArc(d, selectedRoute) ? Math.max(width + 1.5, 3) : width;
  };

  const stationOptions = $derived.by(() => {
    const mode = mapPreferences.stationCircles;
    const preset =
      mode === 'off' ? STATION_CIRCLE_SIZE.large : STATION_CIRCLE_SIZE[mode];
    const baseUnits = $isMediumScreen ? 50_000 : 100_000;
    const getFrequencyScale = (station: VisitedStation) =>
      mapPreferences.stationCircleRadius === 'uniform'
        ? UNIFORM_STATION_FREQUENCY
        : station.frequency;
    return {
      id: 'scatterplot-layer',
      parameters: isGlobe
        ? GLOBE_STATION_PARAMETERS
        : MERCATOR_STATION_PARAMETERS,
      extensions: [globeOcclusion],
      data: visitedStations,
      getPosition: (station: VisitedStation): Position => [
        station.lon,
        station.lat,
      ],
      getRadius: (station: VisitedStation) =>
        getFrequencyScale(station) * baseUnits * preset.scale,
      radiusMaxPixels: preset.maxPixels,
      lineWidthUnits: 'pixels' as const,
      getLineWidth: (station: VisitedStation) =>
        station.id === selectedStationId ||
        selectedRouteStationIds.includes(station.id)
          ? 2
          : 1,
      pickable: true,
      onHover: handleStationHover,
      onClick: handleStationClick,
      getFillColor: getStationFillColor(),
      getLineColor: getStationLineColor(),
      updateTriggers: {
        getFillColor: [
          hoveredArc,
          hoveredStation,
          selectedStationId,
          selectedRoute,
        ],
        getLineColor: [
          hoveredArc,
          hoveredStation,
          selectedStationId,
          selectedRoute,
        ],
        getLineWidth: [selectedStationId, selectedRoute],
        getRadius: [mode, mapPreferences.stationCircleRadius, $isMediumScreen],
      },
      stroked: true,
    };
  });

  const arcOptions = $derived.by(() => ({
    id: 'arc-layer',
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [preciseArcEndpoints, globeOcclusion],
    data: visibleJourneyArcs,
    getSourcePosition: (data: JourneyArc): Position => [
      data.from.lon,
      data.from.lat,
    ],
    getTargetPosition: (data: JourneyArc): Position => [
      data.to.lon,
      data.to.lat,
    ],
    getSourceColor: getArcColor('source'),
    getTargetColor: getArcColor('target'),
    updateTriggers: {
      getSourceColor: [
        hoveredArc,
        hoveredStation,
        mapDetailsState.hoveredJourneyTrackId,
        selectedStationId,
        selectedRoute,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getTargetColor: [
        hoveredArc,
        hoveredStation,
        mapDetailsState.hoveredJourneyTrackId,
        selectedStationId,
        selectedRoute,
        mapPreferences.arcColor,
        arcFrequencyPercentileByRoute,
      ],
      getWidth: [
        mapPreferences.arcThickness,
        mapPreferences.arcThicknessScale,
        selectedJourneyId,
        selectedRoute,
        arcFrequencyPercentileByRoute,
      ],
    },
    getWidth: getVisibleArcWidth,
    getHeight: 0,
    greatCircle: true,
  }));

  // Actual interactivity is recorded from this (invisible) arc, while the visible arc is for display
  // This allows for a larger hover area while keeping the visual arc thin
  const ghostArcOptions = $derived({
    id: 'ghost-arc',
    parameters: isGlobe ? GLOBE_ARC_PARAMETERS : MERCATOR_ROUTE_PARAMETERS,
    extensions: [preciseArcEndpoints, globeOcclusion],
    data: visibleJourneyArcs,
    getSourcePosition: (data: JourneyArc): Position => [
      data.from.lon,
      data.from.lat,
    ],
    getTargetPosition: (data: JourneyArc): Position => [
      data.to.lon,
      data.to.lat,
    ],
    getSourceColor: [0, 0, 0, 0] as Color,
    getTargetColor: [0, 0, 0, 0] as Color,
    pickable: true,
    onHover: handleArcHover,
    onClick: handleArcClick,
    getWidth: 3 * 6,
    getHeight: 0,
    greatCircle: true,
  });

  const getRouteInteraction = (arc: JourneyArc) =>
    resolveRouteInteraction(arc, {
      hoveredArc: effectiveHoveredArc,
      hoveredStationId: hoveredStation?.id,
      selectedStationId,
      selectedRoute,
    });

  const getTrackColor = <T extends JourneyArc>(
    getBaseColor?: (data: T) => Color,
  ) => {
    const baseArcColor = getBaseArcColor('source');

    return (d: T): Color => {
      return applyJourneyTrackInteractionColor(
        getRouteInteraction(d),
        getBaseColor?.(d) ?? baseArcColor(d),
      );
    };
  };

  const getAltitudeTrackColor = () =>
    getTrackColor<JourneyTrackRun>((run) =>
      getJourneyTrackColor({
        altitudeFeet: run.altitudeFeet,
        ground: run.ground,
        estimated: run.estimated,
        darkMode: isDarkMode,
      }),
    );

  const getEstimatedUnderlayColor =
    () =>
    (run: JourneyTrackRun): Color => {
      return getEstimatedTrackUnderlayColor(getRouteInteraction(run));
    };

  const getGroundCasingColor =
    () =>
    (run: JourneyTrackRun): Color => {
      return getGroundTrackCasingColor(getRouteInteraction(run), isDarkMode);
    };

  const journeyTrackWidthUpdateTriggers = $derived([
    mapPreferences.arcThickness,
    mapPreferences.arcThicknessScale,
    selectedJourneyId,
    selectedRoute,
    arcFrequencyPercentileByRoute,
  ]);

  const buildLayers = () => {
    const layers: Layer[] = [];
    layers.push(new ArcLayer(arcOptions));
    layers.push(new ArcLayer(ghostArcOptions));
    layers.push(
      ...buildJourneyTrackLayers({
        data: journeyTrackLayerData,
        style: mapPreferences.journeyTrackStyle,
        context: {
          geometry: {
            parameters: isGlobe
              ? GLOBE_ARC_PARAMETERS
              : MERCATOR_ROUTE_PARAMETERS,
            extensions: [globeOcclusion],
          },
          appearance: {
            getWidth: getVisibleArcWidth,
            getStandardColor: getTrackColor(),
            getAltitudeColor: getAltitudeTrackColor(),
            getGroundCasingColor: getGroundCasingColor(),
            getEstimatedUnderlayColor: getEstimatedUnderlayColor(),
            updateTriggers: {
              width: journeyTrackWidthUpdateTriggers,
              standardColor: [
                hoveredArc,
                hoveredStation,
                mapDetailsState.hoveredJourneyTrackId,
                selectedStationId,
                selectedRoute,
                mapPreferences.arcColor,
                arcFrequencyPercentileByRoute,
              ],
              altitudeColor: [
                hoveredArc,
                hoveredStation,
                mapDetailsState.hoveredJourneyTrackId,
                selectedStationId,
                selectedRoute,
                isDarkMode,
              ],
            },
          },
          interaction: {
            onHover: handleTrackHover,
            onClick: handleTrackClick,
          },
        },
      }),
    );
    if (mapPreferences.stationCircles !== 'off') {
      layers.push(new ScatterplotLayer<VisitedStation>(stationOptions));
    }
    return layers;
  };

  // Globe needs interleaved rendering (deck draws into MapLibre's canvas so
  // the planet can occlude far-side geometry); mercator keeps the original
  // separate-canvas overlay. Switching requires recreating the overlay.
  $effect(() => {
    if (!loaded || !map) return;
    if (currentMapProjection !== mapPreferences.projection) return;
    if (layer && layerProjection === mapPreferences.projection) return;

    if (layer) {
      map.removeControl(layer);
    }

    const nextLayer = new MapLibreOverlay({
      id,
      interleaved: isGlobe,
      onClick: handleMapClick,
      layers: buildLayers(),
    });
    map.addControl(nextLayer);
    layer = nextLayer;
    layerProjection = mapPreferences.projection;
    // Prevent the deck.gl overlay from rendering above map controls when not interleaved.
    const overlayContainer = nextLayer.getCanvas()?.parentElement;
    if (!isGlobe && overlayContainer) {
      overlayContainer.style.zIndex = '-1';
    }
  });

  $effect(() => {
    if (!layer || layerProjection !== mapPreferences.projection) return;
    layer.setProps({
      onClick: handleMapClick,
      layers: buildLayers(),
    });
  });

  // After a basemap switch, `MapLibreOverlay` only re-adds its interleaved
  // layer group if the new style has already finished loading when it sees
  // `styledata`, which it usually hasn't. Without a re-sync the globe loses
  // its arcs until something else updates the overlay, like a hover.
  $effect(() => {
    if (!map || !layer) return;
    const currentMap = map;
    const overlay = layer;
    let pending = false;

    const resync = () => {
      if (!pending || !currentMap.isStyleLoaded()) return;
      pending = false;
      overlay.setProps({ layers: buildLayers() });
    };
    const markPending = () => {
      pending = true;
      resync();
    };

    currentMap.on('style.load', markPending);
    currentMap.on('data', resync);
    currentMap.on('idle', resync);
    return () => {
      currentMap.off('style.load', markPending);
      currentMap.off('data', resync);
      currentMap.off('idle', resync);
    };
  });

  const isVisitedStation = (data: unknown): data is VisitedStation =>
    typeof data === 'object' && data !== null && 'country' in data;

  const isJourneyArc = (data: unknown): data is JourneyArc =>
    typeof data === 'object' && data !== null && 'from' in data && 'to' in data;
</script>

{#if layer}
  <Popup
    openOn="hover"
    anchor="top-left"
    offset={20}
    onopen={popupPosition.setPopup}
  >
    {#snippet children({ data })}
      {#if isVisitedStation(data)}
        <StationPopup {data} {clickable} />
      {:else if isJourneyArc(data)}
        <ArcPopup {data} {clickable} />
      {/if}
    {/snippet}
  </Popup>
{/if}
