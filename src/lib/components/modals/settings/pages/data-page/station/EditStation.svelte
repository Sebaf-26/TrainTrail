<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import StationFormFields from '$lib/components/modals/settings/pages/data-page/station/StationFormFields.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import type { Station } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { stationFormDefaults, stationSchema } from '$lib/zod/station';

  let {
    station,
  }: {
    station: Station;
  } = $props();

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof stationSchema>>(
      {
        ...station,
        uic: station.uic || '',
        municipality: station.municipality || '',
      },
      zod(stationSchema, { defaults: stationFormDefaults }),
    ),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(stationSchema, { defaults: stationFormDefaults }),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.journey.list.utils.invalidate();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance, submitting, tainted } = form;
</script>

<Button variant="outline" size="icon" onclick={() => (open = true)}>
  <SquarePen size="20" />
</Button>

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
  class="max-w-lg"
>
  <ModalBreadcrumbHeader
    section="Stations"
    title="Edit station"
    icon={SquarePen}
  />
  <form method="POST" action="/api/station/save/form" use:enhance>
    <ModalBody>
      <div class="grid gap-4">
        <StationFormFields {form} />
      </div>
    </ModalBody>
    <ModalFooter>
      <Form.Button>Save</Form.Button>
    </ModalFooter>
  </form>
</Modal>
