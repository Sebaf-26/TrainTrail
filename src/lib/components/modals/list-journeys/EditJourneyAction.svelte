<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';

  import EditJourneyModal from '../edit-journey/EditJourneyModal.svelte';

  import { Button } from '$lib/components/ui/button';
  import type { JourneyData } from '$lib/utils';

  let {
    journey,
    triggerDisabled = false,
  }: {
    journey: JourneyData;
    triggerDisabled?: boolean;
  } = $props();

  let open = $state(false);
</script>

<Button
  variant="outline"
  size="icon"
  onclick={() => (open = true)}
  disabled={triggerDisabled}
  aria-label="Edit journey"
  title="Edit journey"
  data-testid="edit-journey-button"
>
  <SquarePen size={16} />
</Button>

{#key journey}
  <EditJourneyModal {journey} bind:open showTrigger={false} />
{/key}
