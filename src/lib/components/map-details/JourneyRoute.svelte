<script lang="ts">
  import { Route } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { api } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';
  import type { JourneyData } from '$lib/utils';

  let { journey }: { journey: JourneyData } = $props();

  let enabled = $state(false);
  let sourceFormat = $state<string | null>(null);
  let loaded = $state(false);
  let drawing = $state(false);

  const load = async (id: number) => {
    try {
      const [isEnabled, track] = await Promise.all([
        api.journey.railRoutingEnabled.query(),
        api.journeyTrack.get.query(id),
      ]);
      if (journey.id !== id) return;
      enabled = isEnabled;
      sourceFormat = track?.sourceFormat ?? null;
    } catch {
      // Nothing to offer is better than an error on every journey.
    } finally {
      if (journey.id === id) loaded = true;
    }
  };

  $effect(() => {
    const id = journey.id;
    loaded = false;
    sourceFormat = null;
    void load(id);
  });

  const draw = async () => {
    drawing = true;
    try {
      const result = await api.journey.drawRoute.mutate(journey.id);
      if (result.status === 'drawn') {
        await invalidateJourneyData();
        sourceFormat = 'rail';
        toast.success('Route drawn along the rails');
      } else if (result.status === 'none') {
        toast.info('No rail route was found between these stations');
      } else if (result.status === 'unavailable') {
        toast.error(result.message);
      }
    } catch {
      toast.error('Could not draw the route');
    } finally {
      drawing = false;
    }
  };
</script>

{#if loaded && sourceFormat === 'rail'}
  <p class="flex items-center gap-1.5 px-4 pb-3 text-xs text-muted-foreground">
    <Route size={14} />
    Route along the rails, © OpenStreetMap contributors
  </p>
{:else if loaded && enabled && sourceFormat === null}
  <section class="px-4 pb-3">
    <Button
      variant="outline"
      size="sm"
      class="w-full justify-center gap-2"
      disabled={drawing}
      onclick={draw}
    >
      <Route size={16} />
      {drawing ? 'Drawing…' : 'Draw along the rails'}
    </Button>
  </section>
{/if}
