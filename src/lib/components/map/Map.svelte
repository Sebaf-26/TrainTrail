<script lang="ts">
  import { Funnel, Fullscreen, Undo2 } from '@o7/icon/lucide';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    AttributionControl,
    Control,
    ControlButton,
    ControlGroup,
    GeolocateControl,
    MapLibre,
    NavigationControl,
  } from 'svelte-maplibre';

  import JourneyTrackLegend from './JourneyTrackLegend.svelte';
  import MapAppearanceControl from './MapAppearanceControl.svelte';
  import MapFallback from './MapFallback.svelte';
  import MapStatusShelf from './MapStatusShelf.svelte';
  import RainViewerLayer from './RainViewerLayer.svelte';
  import TimeOfDayLayer from './TimeOfDayLayer.svelte';

  import { StationsArcsLayer } from '.';

  import { browser } from '$app/environment';
  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import Filters from '$lib/components/journey-filters/Filters.svelte';
  import MobileFiltersModal from '$lib/components/journey-filters/MobileFiltersModal.svelte';
  import {
    createDefaultFilters,
    hasJourneyFilters,
  } from '$lib/components/journey-filters/model';
  import {
    hasTempFilters as hasActiveTempFilters,
    routeMatchesEndpoints,
    type JourneyFilters,
    type Route,
    type TempFilters,
  } from '$lib/components/journey-filters/types';
  import * as Popover from '$lib/components/ui/popover';
  import type { NavigateJourneys } from '$lib/journey-navigation';
  import { includeFocusedRouteOnMap } from '$lib/journey-visibility';
  import { getConfiguredAppMapStyleUrl } from '$lib/map/app-style';
  import {
    createMapCameraController,
    type CameraFocusTarget,
    type MapCameraController,
  } from '$lib/map/camera-controller';
  import { hasFallbackJourneyArcs } from '$lib/map/journey-layer-data';
  import { exposeRenderState } from '$lib/map/render-state';
  import {
    initMapPreferences,
    mapPreferences,
  } from '$lib/map/map-preferences.svelte';
  import { registerPmtilesProtocol } from '$lib/map/pmtiles';
  import { supportsMapWebGL } from '$lib/map/runtime';
  import {
    appConfig,
    journeyScopeState,
    journeyAddedState,
    mapDetailsState,
  } from '$lib/state.svelte';
  import type { JourneyTrackRow } from '$lib/track/schema';
  import {
    cn,
    prepareJourneyArcData,
    prepareVisitedStations,
    type JourneyData,
  } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const unregisterPmtiles = browser ? registerPmtilesProtocol() : null;

  onDestroy(() => unregisterPmtiles?.());

  let {
    journeys,
    filteredJourneys,
    journeyTracks = [],
    filters = $bindable(),
    tempFilters = $bindable(),
    onNavigate,
  }: {
    journeys: JourneyData[];
    filteredJourneys: JourneyData[];
    journeyTracks?: JourneyTrackRow[];
    filters?: JourneyFilters;
    tempFilters?: TempFilters;
    onNavigate?: NavigateJourneys;
  } = $props();

  const showScopeBanner = $derived(journeyScopeState.current.scope !== 'mine');
  const alignStatusWithDetails = $derived(!!mapDetailsState.selection);

  let map: MapLibreMap | undefined = $state.raw(undefined);
  let cameraController: MapCameraController | undefined = $state.raw(undefined);
  let canRenderMap = $state(!browser);
  let filterDrawerOpen = $state(false);
  let showPreviousView = $state(false);
  const currentTheme = $derived(mode.current ?? 'light');
  const style = $derived(
    getConfiguredAppMapStyleUrl(
      currentTheme,
      appConfig.config?.map,
      mapPreferences.basemap,
    ),
  );
  const projection = $derived({ type: mapPreferences.projection });
  const mapRotationEnabled = $derived(mapPreferences.projection === 'mercator');

  // Details focus is a temporary view, not a persistent filter. Journey details
  // isolate one journey. Route details retain the filtered map and add any
  // journeys on the focused route that the persistent filters excluded.
  const drawnJourneys = $derived.by(() => {
    const selection = mapDetailsState.selection;
    if (selection?.type === 'journey') {
      return journeys.filter((journey) => journey.id === selection.journeyId);
    }
    return includeFocusedRouteOnMap(
      filteredJourneys,
      journeys,
      selection?.type === 'route' ? selection.route : null,
    );
  });
  const journeyArcs = $derived.by(() => {
    return prepareJourneyArcData(drawnJourneys);
  });
  const overviewJourneyArcs = $derived.by(() => {
    return prepareJourneyArcData(filteredJourneys);
  });
  const trackJourneyIds = $derived(
    new Set(journeyTracks.map((track) => track.journeyId)),
  );
  const hasFallbackArcs = $derived(
    hasFallbackJourneyArcs(journeyArcs, trackJourneyIds),
  );

  const allVisitedStations = $derived(prepareVisitedStations(journeys));
  const allJourneyArcs = $derived(prepareJourneyArcData(journeys));

  const detailsPanePadding = () => {
    if (!mapDetailsState.selection) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    return $isMediumScreen
      ? { top: 40, right: 40, bottom: 40, left: 420 }
      : { top: 40, right: 20, bottom: window.innerHeight * 0.55, left: 20 };
  };

  let automaticFitRequest = $state(0);
  const requestAutomaticFit = () => {
    automaticFitRequest += 1;
  };

  export const fitJourneys = () => {
    cameraController?.fit(journeyArcs, {
      projection: mapPreferences.projection,
      padding: detailsPanePadding(),
    });
  };

  const restorePreviousView = () => {
    cameraController?.restore(mapRotationEnabled);
  };

  const showClear = $derived(filters ? hasJourneyFilters(filters) : false);

  const routeMatches = (
    item: { from: { id: number }; to: { id: number } },
    route: Route,
  ) => {
    return routeMatchesEndpoints(item.from.id, item.to.id, route);
  };

  const activeStationFilter = $derived.by(() => {
    if (!filters?.stationsEither.length) return null;
    const id = filters.stationsEither[0]!;
    const station = allVisitedStations.find((a) => a.id.toString() === id);
    return {
      id,
      label: station ? station.name : 'Station',
    };
  });

  const activeRouteFilter = $derived.by(() => {
    if (!filters?.routes.length) return null;
    const route = filters.routes[0]!;
    const arc = allJourneyArcs.find((item) => routeMatches(item, route));
    return {
      id: `${route.a}-${route.b}`,
      label: arc ? `${arc.from.name} ↔ ${arc.to.name}` : 'Route',
    };
  });

  let previousFilteredCount = $state(0);
  const hasTempFilters = $derived(hasActiveTempFilters(tempFilters));

  $effect(() => {
    if (!journeyAddedState.added) return;
    if (!map) return;
    if (!journeys.length) return;

    if (filteredJourneys.length) {
      requestAutomaticFit();
    }

    journeyAddedState.added = false;
  });

  $effect(() => {
    const currentCount = filteredJourneys.length;
    if (
      previousFilteredCount !== currentCount &&
      previousFilteredCount > 0 &&
      !hasTempFilters
    ) {
      requestAutomaticFit();
    }

    // If there are temp filters, we don't want to fit as that means the user
    // clicked on a route/station to trigger the list view and fitting in that
    // case looks jarring.
    if (!hasTempFilters) {
      previousFilteredCount = currentCount;
    }
  });

  // Bearing and pitch are locked in globe mode (deck.gl's globe viewport
  // cannot follow them). svelte-maplibre only applies dragRotate at map
  // creation, and touch/keyboard rotation are separate handlers it never
  // touches, so sync all rotation handlers here and square the camera up
  // whenever the projection flips.
  $effect(() => {
    const m = map;
    if (!m || !projection.type) return;
    untrack(() => {
      // Toggled on the container directly: svelte-maplibre's class prop and
      // maplibre's own imperative classList writes fight over the class
      // attribute, so a reactive class prop is unreliable here.
      m.getContainer().classList.toggle('rotation-locked', !mapRotationEnabled);
      if (mapRotationEnabled) {
        m.dragRotate.enable();
        m.keyboard.enableRotation();
        m.touchZoomRotate.enableRotation();
      } else {
        m.dragRotate.disable();
        m.keyboard.disableRotation();
        m.touchZoomRotate.disableRotation();
      }
      cameraController?.normalizeOrientation(mapRotationEnabled);
    });
  });

  // Drive edge padding + camera focus from details-pane state.
  //
  // When the camera moves significantly, use flyTo for its parabolic arc —
  // looks much better than easeTo's linear interpolation for big distance +
  // zoom changes (overview→station, switching to a far-away route).
  //
  // When the camera target matches the current camera (reselect of the same
  // station/route after a deselect), use easeTo so `padding` is interpolated
  // smoothly — flyTo treats padding as an end-state and would snap.
  //
  $effect(() => {
    const selection = mapDetailsState.selection;
    const focusRequest = mapDetailsState.focusRequest;
    const controller = cameraController;
    if (!controller) return;

    const padding = detailsPanePadding();
    let focusTarget: CameraFocusTarget | undefined;

    if (selection) {
      if (selection.type === 'station') {
        const station = allVisitedStations.find(
          (a) => a.id === selection.stationId,
        );
        if (station) {
          focusTarget = {
            type: 'point',
            center: [station.lon, station.lat],
            zoom: 13,
          };
        }
      } else {
        // route or journey — both fit a single great-circle arc between two
        // stations, resolved by station ID straight from the journeys. The
        // deduplicated arc list (allJourneyArcs) is keyed by station *name*, so
        // two distinct station pairs sharing a name collapse into one arc under
        // the first pair's IDs; an ID lookup there would miss the second pair
        // and leave the map unfocused.
        const arc = (() => {
          if (selection.type === 'journey') {
            const f = journeys.find((fl) => fl.id === selection.journeyId);
            return f?.from && f.to ? { from: f.from, to: f.to } : null;
          }
          const route = selection.route;
          const f = journeys.find(
            (fl) =>
              fl.from != null &&
              fl.to != null &&
              routeMatches({ from: fl.from, to: fl.to }, route),
          );
          return f?.from && f.to ? { from: f.from, to: f.to } : null;
        })();
        if (arc) {
          focusTarget = {
            type: 'arcs',
            arcs: [arc],
            projection: mapPreferences.projection,
          };
        }
      }
    }

    controller.reconcile({
      selectionActive: !!selection,
      focusRequest,
      focusTarget,
      padding,
      projection: mapPreferences.projection,
      overviewArcs: overviewJourneyArcs,
      automaticFitRequest,
    });
  });

  $effect(() => {
    const m = map;
    if (!m) return;

    const controller = createMapCameraController(m, {
      onPreviousViewChange: (available) => {
        showPreviousView = available;
      },
    });
    cameraController = controller;

    return () => {
      controller.destroy();
      if (cameraController === controller) cameraController = undefined;
    };
  });

  $effect(() => {
    if (map) return exposeRenderState(map);
  });

  onMount(() => {
    canRenderMap = supportsMapWebGL();
    initMapPreferences();
  });
</script>

{#if showScopeBanner}
  <div
    class={cn(
      'absolute top-3 left-1/2 z-10 w-[min(400px,calc(100%-2rem))] -translate-x-1/2 transition-[left] duration-200',
      alignStatusWithDetails ? 'md:left-[calc(50%+12rem)]' : '',
    )}
  >
    <AdminScopeBanner />
  </div>
{/if}

{#if canRenderMap}
  <MapLibre
    onload={() => {
      map?.touchPitch.disable();
      cameraController?.normalizeOrientation(mapRotationEnabled);
      requestAutomaticFit();
    }}
    bind:map
    {style}
    {projection}
    dragRotate={mapRotationEnabled}
    pitchWithRotate={false}
    maxPitch={0}
    diffStyleUpdates
    class="relative h-full"
    attributionControl={false}
  >
    <AttributionControl compact={true} />
    <NavigationControl position="top-right" />
    <GeolocateControl position="top-right" />
    <Control position="top-right">
      <ControlGroup>
        <MapAppearanceControl
          {hasFallbackArcs}
          showTracksSection={journeyTracks.length > 0}
        />
      </ControlGroup>
    </Control>
    {#if journeys.length}
      <Control position="top-right">
        <ControlGroup>
          <ControlButton onclick={fitJourneys} title="Fit visible journeys">
            <Fullscreen size={20} />
          </ControlButton>
          {#if filters}
            {#if $isMediumScreen}
              <Popover.Root>
                <Popover.Trigger>
                  <ControlButton title="Filter journeys">
                    <span class="relative inline-flex">
                      <Funnel size={18} />
                      {#if showClear || hasTempFilters}
                        <span
                          aria-hidden="true"
                          data-map-filter-dot
                          class="absolute -right-1 -top-1 size-2.5 rounded-full bg-blue-500 ring-2 ring-background"
                        ></span>
                      {/if}
                    </span>
                  </ControlButton>
                </Popover.Trigger>
                <Popover.Content
                  side="left"
                  class="flex w-fit grow-0 flex-col gap-2 p-3"
                >
                  <Filters
                    bind:journeys
                    bind:filters
                    bind:tempFilters
                    layout="stacked"
                    presentation="map-popover"
                  />
                </Popover.Content>
              </Popover.Root>
            {:else}
              <ControlButton
                onclick={() => (filterDrawerOpen = true)}
                title="Filter journeys"
              >
                <span class="relative inline-flex">
                  <Funnel size={18} />
                  {#if showClear || hasTempFilters}
                    <span
                      aria-hidden="true"
                      data-map-filter-dot
                      class="absolute right-0 top-0 size-2 rounded-full bg-blue-500 ring-2 ring-background"
                    ></span>
                  {/if}
                </span>
              </ControlButton>
            {/if}
          {/if}
        </ControlGroup>
      </Control>
      <Control position="top-right">
        {#if showClear}
          <div
            class="maplibregl-ctrl-group bg-destructive! hover:bg-destructive/80!"
            data-clear-ctrl
          >
            <ControlButton
              onclick={() => {
                filters = createDefaultFilters();
              }}
              title="Clear filters"
            >
              <Undo2 size={20} />
            </ControlButton>
          </div>
        {/if}
      </Control>
    {/if}

    <MapStatusShelf
      {showPreviousView}
      {activeStationFilter}
      {activeRouteFilter}
      {showScopeBanner}
      alignWithDetails={alignStatusWithDetails}
      onPreviousView={restorePreviousView}
      onClearStationFilter={() => {
        if (filters) filters.stationsEither = [];
      }}
      onClearRouteFilter={() => {
        if (filters) filters.routes = [];
      }}
    />

    {#if journeyTracks.length > 0 && mapPreferences.routeDisplay === 'tracks' && mapPreferences.journeyTrackStyle === 'altitude' && !showPreviousView}
      <JourneyTrackLegend />
    {/if}

    {#if mapPreferences.timeOfDayEnabled}
      <TimeOfDayLayer />
    {/if}

    {#if mapPreferences.rainViewerEnabled}
      <RainViewerLayer />
    {/if}

    <StationsArcsLayer
      journeys={drawnJourneys}
      {journeyArcs}
      {journeyTracks}
      bind:tempFilters
      {onNavigate}
    />
  </MapLibre>

  {#if filters && !$isMediumScreen}
    <MobileFiltersModal
      bind:open={filterDrawerOpen}
      {journeys}
      bind:filters
      bind:tempFilters
    />
  {/if}
{:else}
  <MapFallback {journeys} {filteredJourneys} />
{/if}

<style>
  /* The compass is dead weight while rotation is locked (globe mode):
     bearing is pinned to 0 and the compass's own drag-to-rotate bypasses
     the dragRotate handler. svelte-maplibre freezes NavigationControl
     options at creation, so hide it with CSS instead of a prop.
     !important because app.css forces `display: flex !important` on all
     control-group buttons. */
  :global(.rotation-locked .maplibregl-ctrl-compass) {
    display: none !important;
  }
</style>
