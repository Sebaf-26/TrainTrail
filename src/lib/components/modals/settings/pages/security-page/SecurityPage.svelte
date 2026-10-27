<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import ApiKeys from './ApiKeys.svelte';
  import EditPassword from './EditPassword.svelte';
  import OAuth from './OAuth.svelte';
  import ConnectedApps from './ConnectedApps.svelte';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { api } from '$lib/trpc';
  import { invalidateJourneyData } from '$lib/trpc/invalidation';

  const user = $derived(page.data.user);

  const deleteJourneys = async () => {
    const toastId = toast.loading('Deleting all your journeys...');
    try {
      await api.journey.deleteAll.mutate();
      await invalidateJourneyData();
      toast.info('All your journeys have been deleted.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete your journeys', { id: toastId });
    }
  };
</script>

<PageHeader title="Security" subtitle="Manage your account security settings.">
  <div class="flex items-center justify-between p-4 rounded-lg border">
    <h4 class="font-medium leading-4">Password</h4>
    <div>
      <EditPassword />
    </div>
  </div>
  <OAuth {user} />
  <ApiKeys />
  <ConnectedApps />
  {#if hasClientPermission(page.data.authorization, 'journey.delete.own')}
    <div class="flex items-center justify-between p-4 rounded-lg border">
      <h4 class="font-medium leading-4">Danger zone</h4>
      <div>
        <Confirm
          onConfirm={deleteJourneys}
          title="Delete all journeys"
          description="Are you sure you want to delete all your journeys? This does not include journeys you share with other users. This action cannot be undone."
          confirmText="Delete"
        >
          {#snippet triggerContent({ props })}
            <Button variant="destructiveOutline" {...props}>
              Delete all journeys
            </Button>
          {/snippet}
        </Confirm>
      </div>
    </div>
  {/if}
</PageHeader>
