import {
  normalizeRoute,
  type Route,
} from '$lib/components/journey-filters/types';
import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
import { DEFAULT_JOURNEY_SCOPE, type JourneyScope } from '$lib/journey-scope';
import type { DeepBoolean } from '$lib/utils';

export const journeyAddedState = $state({
  added: false,
});

export const journeyListFocusState = $state<{
  journeyId: number | null;
  request: number;
}>({
  journeyId: null,
  request: 0,
});

export const focusJourneyInList = (journeyId: number) => {
  journeyListFocusState.journeyId = journeyId;
  journeyListFocusState.request += 1;
};

export const clearJourneyListFocus = () => {
  journeyListFocusState.journeyId = null;
  journeyListFocusState.request += 1;
};

export type SettingsTabId =
  | 'general'
  | 'preferences'
  | 'security'
  | 'appearance'
  | 'share'
  | 'import'
  | 'export'
  | 'data'
  | 'custom-fields'
  | 'users'
  | 'oauth';

export type OpenModalsState = {
  addJourney: boolean;
  /** Asks whether to fill a journey in by hand or to import a ticket. */
  addJourneyChoice: boolean;
  listJourneys: boolean;
  statistics: boolean;
  settings: boolean;
  settingsTab: SettingsTabId;
  /** The import source Settings > Import opens on, set by whoever opens it. */
  importPlatform: 'ticket' | null;
};

export const openModalsState = $state<OpenModalsState>({
  addJourney: false,
  addJourneyChoice: false,
  listJourneys: false,
  statistics: false,
  settings: false,
  settingsTab: 'general',
  importPlatform: null,
});

export type MapDetailsSelection =
  | { type: 'station'; stationId: number }
  | { type: 'route'; route: Route }
  | { type: 'journey'; journeyId: number };

export const mapDetailsState = $state<{
  selection: MapDetailsSelection | null;
  focusRequest: number;
  hoveredJourneyTrackId: number | null;
}>({
  selection: null,
  focusRequest: 0,
  hoveredJourneyTrackId: null,
});

export const openStationDetails = (stationId: number) => {
  mapDetailsState.selection = { type: 'station', stationId };
  mapDetailsState.focusRequest += 1;
};

export const openRouteDetails = (route: Route) => {
  mapDetailsState.selection = {
    type: 'route',
    route: normalizeRoute(route.a, route.b),
  };
  mapDetailsState.focusRequest += 1;
};

export const openJourneyDetails = (journeyId: number) => {
  mapDetailsState.selection = { type: 'journey', journeyId };
  mapDetailsState.focusRequest += 1;
};

export const focusMapDetails = () => {
  if (!mapDetailsState.selection) return;
  mapDetailsState.focusRequest += 1;
};

export const closeMapDetails = () => {
  mapDetailsState.selection = null;
};

export const appConfig = $state<{
  config: ClientAppConfig | null;
  configured: DeepBoolean<FullAppConfig, boolean> | null;
  envConfigured: DeepBoolean<FullAppConfig, boolean> | null;
}>({
  config: null,
  configured: null,
  envConfigured: null,
});

export const journeyScopeState = $state<{
  current: JourneyScope;
}>({
  current: DEFAULT_JOURNEY_SCOPE,
});

export const setJourneyScope = (scope: JourneyScope) => {
  journeyScopeState.current = scope;
};

export const versionState = $state<{
  currentVersion: string;
  latestVersion: string | null;
  newReleases: Array<{ name: string; body: string }>;
  isChecking: boolean;
  alreadyChecked: boolean;
}>({
  currentVersion: '',
  latestVersion: null,
  newReleases: [],
  isChecking: false,
  alreadyChecked: false,
});
