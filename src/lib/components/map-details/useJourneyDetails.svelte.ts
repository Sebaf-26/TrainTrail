import { page } from '$app/state';
import type { NavigateJourneys } from '$lib/journey-navigation';
import { mapDetailsState, openRouteDetails } from '$lib/state.svelte';
import { type JourneyData } from '$lib/utils';
import { getPreferences } from '$lib/utils/preferences';

export function useJourneyDetails(
  journeys: () => JourneyData[],
  onNavigate: NavigateJourneys,
) {
  const prefs = $derived(getPreferences(page.data.user));

  const selectedJourneyId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'journey' ? selection.journeyId : null;
  });

  const journey = $derived.by(() => {
    const id = selectedJourneyId;
    if (id === null) return null;
    return journeys().find((f) => f.id === id) ?? null;
  });

  const showRoute = () => {
    if (!journey?.from || !journey.to) return;
    // Swap the pane over to the route details; the map follows the pane, so it
    // returns to the whole route's journeys on its own.
    openRouteDetails({
      a: journey.from.id.toString(),
      b: journey.to.id.toString(),
    });
  };

  const showInList = () => {
    if (!journey) return;
    onNavigate({
      destination: 'list',
      focus: { type: 'journey', journeyId: journey.id },
    });
  };

  return {
    get prefs() {
      return prefs;
    },
    get journey() {
      return journey;
    },
    showRoute,
    showInList,
  };
}
