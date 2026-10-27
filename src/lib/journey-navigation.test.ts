import { describe, expect, it, vi } from 'vitest';

import {
  createJourneyNavigator,
  planJourneyNavigation,
} from './journey-navigation';
import {
  canShowJourneyOnMap,
  includeFocusedJourneyInList,
  includeFocusedRouteOnMap,
} from './journey-visibility';

import { createDefaultTempFilters } from '$lib/components/journey-filters/types';

const journey = (id: number, from: number | null, to: number | null) => ({
  id,
  from: from === null ? null : { id: from },
  to: to === null ? null : { id: to },
});

const createNavigator = (statisticsOpen = false) => {
  let state = {
    tempFilters: createDefaultTempFilters(),
    focusedListJourneyId: null as number | null,
    listOpen: false,
    statisticsOpen,
  };
  const events: string[] = [];
  const focusJourneyInList = vi.fn();
  const openJourneyDetails = vi.fn();
  const navigate = createJourneyNavigator({
    getState: () => state,
    commitState: (next) => {
      state = next;
      events.push(
        `commit:list=${next.listOpen},statistics=${next.statisticsOpen}`,
      );
    },
    focusJourneyInList,
    waitForModalClose: async () => {
      events.push('wait');
    },
    openJourneyDetails: (journeyId) => {
      openJourneyDetails(journeyId);
      events.push(`details:${journeyId}`);
    },
  });

  return {
    navigate,
    focusJourneyInList,
    openJourneyDetails,
    events,
    state: () => ({
      ...state,
      statsOpen: state.statisticsOpen,
    }),
  };
};

describe('journey navigation', () => {
  it('keeps excluded journeys on the focused route drawable', () => {
    const visible = [journey(1, 1, 2), journey(2, 3, 4)];
    const all = [...visible, journey(3, 2, 1), journey(4, 5, 6)];

    expect(
      includeFocusedRouteOnMap(visible, all, { a: '1', b: '2' }).map(
        (item) => item.id,
      ),
    ).toEqual([1, 2, 3]);
  });

  it('preserves the filtered array when no route is focused', () => {
    const visible = [journey(1, 1, 2)];

    expect(includeFocusedRouteOnMap(visible, visible, null)).toBe(visible);
  });

  it('includes a focused list journey outside persistent filters', () => {
    expect(
      includeFocusedJourneyInList(
        [journey(1, 1, 2)],
        [journey(1, 1, 2), journey(2, 3, 4)],
        2,
      ),
    ).toMatchObject({
      focusedJourneyOutsideFilters: true,
      journeys: [{ id: 1 }, { id: 2 }],
    });
  });

  it('only maps journeys with both endpoints', () => {
    expect(canShowJourneyOnMap(journey(1, 1, 2))).toBe(true);
    expect(canShowJourneyOnMap(journey(2, null, 2))).toBe(false);
    expect(canShowJourneyOnMap(journey(3, 1, null))).toBe(false);
  });

  it('plans navigation without mutating the current state', () => {
    const current = {
      tempFilters: createDefaultTempFilters(),
      focusedListJourneyId: null,
      listOpen: false,
      statisticsOpen: true,
    };

    const transition = planJourneyNavigation(
      {
        destination: 'list',
        focus: { type: 'route', route: { a: '1', b: '2' } },
      },
      current,
    );

    expect(current.tempFilters.routes).toEqual([]);
    expect(transition.state).toMatchObject({
      listOpen: true,
      statisticsOpen: true,
      tempFilters: { routes: [{ a: '1', b: '2' }] },
    });
  });

  it('opens a route-focused list with only the route temp filter', async () => {
    const harness = createNavigator();

    await harness.navigate({
      destination: 'list',
      focus: { type: 'route', route: { a: '1', b: '2' } },
    });

    expect(harness.state()).toMatchObject({
      focusedListJourneyId: null,
      listOpen: true,
      tempFilters: {
        departureStations: [],
        arrivalStations: [],
        stationsEither: [],
        routes: [{ a: '1', b: '2' }],
      },
    });
  });

  it.each(['departure', 'arrival'] as const)(
    'opens a station-focused list for %s journeys',
    async (direction) => {
      const harness = createNavigator();

      await harness.navigate({
        destination: 'list',
        focus: {
          type: 'station',
          stationId: 42,
          direction,
        },
      });

      expect(harness.state()).toMatchObject({
        focusedListJourneyId: null,
        listOpen: true,
        tempFilters: {
          departureStations: direction === 'departure' ? ['42'] : [],
          arrivalStations: direction === 'arrival' ? ['42'] : [],
          routes: [],
        },
      });
      expect(harness.focusJourneyInList).not.toHaveBeenCalled();
    },
  );

  it('opens a journey-focused list outside temporary filters', async () => {
    const harness = createNavigator();

    await harness.navigate({
      destination: 'list',
      focus: { type: 'journey', journeyId: 9 },
    });

    expect(harness.state()).toMatchObject({
      focusedListJourneyId: 9,
      listOpen: true,
      tempFilters: createDefaultTempFilters(),
    });
    expect(harness.focusJourneyInList).toHaveBeenCalledWith(9);
  });

  it('closes modal history before opening journey details on the map', async () => {
    const harness = createNavigator(true);

    await harness.navigate({
      destination: 'map',
      focus: { type: 'journey', journeyId: 11 },
    });

    expect(harness.state()).toMatchObject({
      listOpen: false,
      statsOpen: false,
      tempFilters: createDefaultTempFilters(),
    });
    expect(harness.openJourneyDetails).toHaveBeenCalledWith(11);
    expect(harness.events).toEqual([
      'commit:list=false,statistics=false',
      'wait',
      'details:11',
    ]);
  });
});
