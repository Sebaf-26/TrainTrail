<script lang="ts">
  import { ChevronDown } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { slide } from 'svelte/transition';
  import { superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { goto } from '$app/navigation';
  import { PreferenceField, PresetPicker } from '$lib/components/preferences';
  import * as Form from '$lib/components/ui/form';
  import { Globe } from '$lib/components/ui/globe';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import { cn } from '$lib/utils';
  import { presets } from '$lib/utils/preferences';
  import { signUpSchema } from '$lib/zod/auth';

  const { data } = $props();
  const { isSetup } = data;

  onMount(async () => {
    if (isSetup) {
      toast.info('TrainTrail is already setup');
      await goto('/');
    }
  });

  const form = superForm(data.form, {
    validators: zod(signUpSchema),
    onUpdated({ form }) {
      if (form.message) {
        toast.error(form.message.text);
      }
    },
  });
  const { form: formData, enhance, submitting } = form;

  // Default the preset selection to Metric so the form has concrete values
  // even if the user never opens the picker / customize section.
  $effect(() => {
    const v = presets.metric.values;
    if (!$formData.distanceUnit) {
      $formData.distanceUnit = v.distanceUnit;
      $formData.timeFormat = v.timeFormat;
      $formData.dateFormat = v.dateFormat;
      $formData.weekStartsOn = v.weekStartsOn;
      $formData.journeyTimeDisplay = v.journeyTimeDisplay;
    }
  });

  const currentPrefs = $derived({
    distanceUnit: $formData.distanceUnit,
    timeFormat: $formData.timeFormat,
    dateFormat: $formData.dateFormat,
    weekStartsOn: $formData.weekStartsOn,
    journeyTimeDisplay: $formData.journeyTimeDisplay,
  });

  let showCustom = $state(false);
</script>

<div class="h-full grid lg:grid-cols-2">
  <div class="flex items-center justify-center overflow-y-auto py-8">
    <div class="mx-auto grid w-[420px] max-w-full gap-6 px-4">
      <div class="grid gap-2 text-center">
        <h1 class="text-3xl font-bold">Welcome</h1>
        <p class="text-muted-foreground text-balance">
          Welcome to TrainTrail! Please set up your owner account to get
          started.
        </p>
      </div>
      <form
        method="POST"
        action="/api/users/setup"
        use:enhance
        class="grid gap-4"
      >
        <Form.Field {form} name="username">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Username</Form.Label>
              <Input {...props} bind:value={$formData.username} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="password">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Password</Form.Label>
              <PasswordInput {...props} bind:value={$formData.password} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="displayName">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Display Name</Form.Label>
              <Input {...props} bind:value={$formData.displayName} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>

        <div class="grid gap-2">
          <span class="text-sm font-medium">Preferences</span>
          <PresetPicker
            mode="select"
            current={currentPrefs}
            onApplied={(_, values) => {
              $formData.distanceUnit = values.distanceUnit;
              $formData.timeFormat = values.timeFormat;
              $formData.dateFormat = values.dateFormat;
              $formData.weekStartsOn = values.weekStartsOn;
              $formData.journeyTimeDisplay = values.journeyTimeDisplay;
            }}
          />
          <button
            type="button"
            onclick={() => (showCustom = !showCustom)}
            class="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              size={14}
              class={cn('transition-transform', showCustom && 'rotate-180')}
            />
            {showCustom ? 'Hide' : 'Customize'} individual settings
          </button>

          {#if showCustom}
            <div
              transition:slide={{ duration: 180 }}
              class="grid gap-3 sm:grid-cols-2 pt-1"
            >
              <PreferenceField
                field="distanceUnit"
                value={$formData.distanceUnit}
                onChange={(v) =>
                  ($formData.distanceUnit = v as typeof $formData.distanceUnit)}
              />
              <PreferenceField
                field="timeFormat"
                value={$formData.timeFormat}
                onChange={(v) =>
                  ($formData.timeFormat = v as typeof $formData.timeFormat)}
              />
              <PreferenceField
                field="dateFormat"
                value={$formData.dateFormat}
                onChange={(v) =>
                  ($formData.dateFormat = v as typeof $formData.dateFormat)}
              />
              <PreferenceField
                field="weekStartsOn"
                value={$formData.weekStartsOn}
                onChange={(v) =>
                  ($formData.weekStartsOn = v as typeof $formData.weekStartsOn)}
              />
              <PreferenceField
                field="journeyTimeDisplay"
                value={$formData.journeyTimeDisplay}
                onChange={(v) =>
                  ($formData.journeyTimeDisplay =
                    v as typeof $formData.journeyTimeDisplay)}
              />
            </div>
          {/if}

          <input
            type="hidden"
            name="distanceUnit"
            value={$formData.distanceUnit}
          />
          <input type="hidden" name="timeFormat" value={$formData.timeFormat} />
          <input type="hidden" name="dateFormat" value={$formData.dateFormat} />
          <input
            type="hidden"
            name="weekStartsOn"
            value={$formData.weekStartsOn}
          />
          <input
            type="hidden"
            name="journeyTimeDisplay"
            value={$formData.journeyTimeDisplay}
          />
        </div>

        <Form.Button loading={$submitting}>Create</Form.Button>
      </form>
    </div>
  </div>
  <div class="items-center justify-center relative hidden lg:flex">
    <Globe />
  </div>
</div>
