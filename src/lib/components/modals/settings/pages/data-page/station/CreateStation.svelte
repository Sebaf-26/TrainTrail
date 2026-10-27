<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import StationFormFields from './StationFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import {
    stationSearchCache,
    clearStationLookupCaches,
  } from '$lib/utils/data/stations/cache';
  import { stationFormDefaults, stationSchema } from '$lib/zod/station';

  let {
    open = $bindable(false),
    onStationCreate,
    withoutTrigger = false,
  }: {
    open?: boolean;
    onStationCreate?: () => Promise<void>;
    withoutTrigger?: boolean;
  } = $props();

  const form = superForm(
    defaults<Infer<typeof stationSchema>>(
      zod(stationSchema, { defaults: stationFormDefaults }),
    ),
    {
      dataType: 'json',
      validators: zod(stationSchema, { defaults: stationFormDefaults }),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            open = false;
            stationSearchCache.clear();
            clearStationLookupCaches();
            onStationCreate?.();
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance, submitting, tainted } = form;
</script>

{#if !withoutTrigger}
  <Button variant="outline" onclick={() => (open = true)}>
    <Plus size={16} class="shrink-0" />
    Create
  </Button>
{/if}

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
>
  <ModalBreadcrumbHeader section="Stations" title="Add station" icon={Plus} />
  <form method="POST" action="/api/station/save/form" use:enhance>
    <ModalBody>
      <div class="grid gap-4">
        <StationFormFields {form} />
      </div>
    </ModalBody>
    <ModalFooter>
      <Form.Button>Create</Form.Button>
    </ModalFooter>
  </form>
</Modal>
