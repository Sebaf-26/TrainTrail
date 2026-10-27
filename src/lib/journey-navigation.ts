import {
  createDefaultTempFilters,
  setTempArrivalStation,
  setTempDepartureStation,
  setTempRoute,
  type Route,
  type TempFilters,
} from '$lib/components/journey-filters/types';

export type JourneyListFocus =
  | { type: 'journey'; journeyId: number }
  | { type: 'route'; route: Route }
  | {
      type: 'station';
      stationId: number;
      direction: 'departure' | 'arrival';
    };

export type JourneyNavigationIntent =
  | { destination: 'list'; focus: JourneyListFocus }
  | {
      destination: 'map';
      focus: { type: 'journey'; journeyId: number };
    };

export type NavigateJourneys = (
  intent: JourneyNavigationIntent,
) => void | Promise<void>;

export type JourneyNavigationState = {
  tempFilters: TempFilters;
  focusedListJourneyId: number | null;
  listOpen: boolean;
  statisticsOpen: boolean;
};

type JourneyNavigationTransition = {
  state: JourneyNavigationState;
  focusJourneyId?: number;
  detailJourneyId?: number;
};

export type JourneyNavigatorDependencies = {
  getState: () => JourneyNavigationState;
  commitState: (state: JourneyNavigationState) => void;
  focusJourneyInList: (journeyId: number) => void;
  waitForModalClose: () => Promise<void>;
  openJourneyDetails: (journeyId: number) => void;
};

export const planJourneyNavigation = (
  intent: JourneyNavigationIntent,
  current: JourneyNavigationState,
): JourneyNavigationTransition => {
  const tempFilters = createDefaultTempFilters();

  if (intent.destination === 'map') {
    return {
      state: {
        tempFilters,
        focusedListJourneyId: null,
        listOpen: false,
        statisticsOpen: false,
      },
      detailJourneyId: intent.focus.journeyId,
    };
  }

  const focus = intent.focus;
  let focusJourneyId: number | undefined;
  if (focus.type === 'route') {
    setTempRoute(tempFilters, focus.route);
  } else if (focus.type === 'station') {
    const setStation =
      focus.direction === 'departure'
        ? setTempDepartureStation
        : setTempArrivalStation;
    setStation(tempFilters, focus.stationId.toString());
  } else {
    focusJourneyId = focus.journeyId;
  }

  return {
    state: {
      tempFilters,
      focusedListJourneyId: focusJourneyId ?? null,
      listOpen: true,
      statisticsOpen: current.statisticsOpen,
    },
    focusJourneyId,
  };
};

export const createJourneyNavigator = (
  dependencies: JourneyNavigatorDependencies,
): NavigateJourneys => {
  return async (intent) => {
    const transition = planJourneyNavigation(intent, dependencies.getState());
    dependencies.commitState(transition.state);
    if (transition.focusJourneyId !== undefined) {
      dependencies.focusJourneyInList(transition.focusJourneyId);
    }
    if (transition.detailJourneyId === undefined) return;

    await dependencies.waitForModalClose();
    dependencies.openJourneyDetails(transition.detailJourneyId);
  };
};
