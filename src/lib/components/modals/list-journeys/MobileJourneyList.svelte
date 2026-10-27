<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { DirectionsRailway } from '@o7/icon/material';

  import type { JourneyIndicator } from './journey-indicators';
  import type { JourneyListYear } from './journey-list-groups';
  import JourneyCard from './JourneyCard.svelte';
  import JourneyIndicators from './JourneyIndicators.svelte';
  import PastJourneysDivider from './PastJourneysDivider.svelte';
  import SwipeableJourneyRow from './SwipeableJourneyRow.svelte';

  import type { JourneyData } from '$lib/utils';
  import { cn } from '$lib/utils';

  type Journey = JourneyData & {
    month?: string | null;
    passengerLabels?: string[];
    indicators?: JourneyIndicator[];
  };

  let {
    journeysByYear,
    selecting = false,
    selectedJourneys = $bindable<number[]>([]),
    onEdit,
    onDelete,
    canUpdateJourney = () => true,
    canDeleteJourney = () => true,
    onShowOnMap,
    readonly = false,
  }: {
    journeysByYear: JourneyListYear<Journey>[];
    selecting?: boolean;
    selectedJourneys?: number[];
    onEdit?: (journey: JourneyData) => void;
    onDelete?: (journey: JourneyData) => void;
    canUpdateJourney?: (journey: JourneyData) => boolean;
    canDeleteJourney?: (journey: JourneyData) => boolean;
    onShowOnMap?: (journey: JourneyData) => void;
    readonly?: boolean;
  } = $props();

  // Store refs to SwipeableJourneyRow components for resetting
  let swipeableRefs: Record<number, SwipeableJourneyRow | undefined> = $state(
    {},
  );

  // Expose a method to reset all swipeable rows
  export const resetAllRows = () => {
    Object.values(swipeableRefs).forEach((ref) => ref?.reset?.());
  };

  const toggleSelection = (journeyId: number) => {
    if (selectedJourneys.includes(journeyId)) {
      selectedJourneys = selectedJourneys.filter((id) => id !== journeyId);
    } else {
      selectedJourneys = [...selectedJourneys, journeyId];
    }
  };
</script>

{#if journeysByYear.length === 0}
  <div class="h-full flex items-center justify-center">
    <DirectionsRailway class="text-muted-foreground size-[20dvw]" />
  </div>
{:else}
  <div class="flex flex-col" use:autoAnimate>
    {#each journeysByYear as { year, groups }, yearIndex (year)}
      <div use:autoAnimate>
        {#each groups as group, groupIndex (group.key)}
          {@const isFirstGroup = yearIndex === 0 && groupIndex === 0}
          <!-- Separators sit between groups, outside the swipeable rows so they
               keep their own stacking context. Legs connected by a change of train are
               not separated at all. -->
          {#if group.startsPastSection}
            <PastJourneysDivider />
          {:else if !isFirstGroup}
            <div class="relative z-10 h-px bg-border"></div>
          {/if}
          {#each group.journeys as journey (journey.id)}
            {@const isSelected =
              !readonly && selecting && selectedJourneys.includes(journey.id)}
            <div
              id="journey-list-row-{journey.id}"
              class="isolate scroll-mt-24"
            >
              <SwipeableJourneyRow
                bind:this={swipeableRefs[journey.id]}
                disabled={selecting || readonly}
                onEdit={readonly || !canUpdateJourney(journey)
                  ? undefined
                  : () => onEdit?.(journey)}
                onDelete={readonly || !canDeleteJourney(journey)
                  ? undefined
                  : () => onDelete?.(journey)}
                onShowOnMap={readonly ||
                !onShowOnMap ||
                !journey.from ||
                !journey.to
                  ? undefined
                  : () => onShowOnMap?.(journey)}
              >
                {#snippet children({ isInteracting })}
                  <button
                    type="button"
                    class={cn(
                      'w-full px-4 py-4 transition-colors',
                      isSelected
                        ? 'bg-destructive/10 hover:bg-destructive/15'
                        : !isInteracting && 'hover:bg-hover active:bg-hover',
                    )}
                    onclick={() => {
                      if (!readonly && selecting) {
                        toggleSelection(journey.id);
                      }
                    }}
                  >
                    <JourneyCard
                      {journey}
                      passengerLabels={journey.passengerLabels}
                    >
                      {#snippet indicators()}
                        <JourneyIndicators
                          indicators={journey.indicators ?? []}
                          size={15}
                          tooltips={false}
                        />
                      {/snippet}
                    </JourneyCard>
                  </button>
                {/snippet}
              </SwipeableJourneyRow>
            </div>
          {/each}
        {/each}
      </div>
    {/each}
  </div>
{/if}
