<script lang="ts">
  import TrainPicker from '$lib/components/form-fields/TrainPicker.svelte';
  import OperatorPicker from '$lib/components/form-fields/OperatorPicker.svelte';
  import StationPicker from '$lib/components/form-fields/StationPicker.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import type { Train, Operator, Station } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import {
    isEntityType,
    normalizeOptions,
    type FieldType,
  } from '$lib/utils/custom-fields';

  // Module-level cache: avoids re-fetching the same entity on every mount
  const entityCache = new Map<string, Station | Operator | Train>();

  let {
    id,
    label,
    fieldType,
    required = false,
    options = [],
    description = '',
    value = $bindable<unknown>(null),
    error = '',
    onchange,
  }: {
    id?: string;
    label: string;
    fieldType: FieldType;
    required?: boolean;
    options?: string[];
    description?: string;
    value?: unknown;
    error?: string;
    onchange?: (value: unknown) => void;
  } = $props();

  const fieldId = $derived(
    id ?? `cf-${label.replace(/\s+/g, '-').toLowerCase()}`,
  );

  const resolvedOptions = $derived(normalizeOptions(options));

  const set = (v: unknown) => {
    value = v;
    onchange?.(v);
  };

  // Entity picker state: resolve numeric ID → full object for the picker
  let entityObj = $state<Station | Operator | Train | null>(null);
  let resolvedId = $state<number | null>(null);

  $effect(() => {
    if (!isEntityType(fieldType)) return;

    const numId = typeof value === 'number' ? value : null;

    // Already resolved this ID
    if (numId === resolvedId && entityObj) return;

    if (numId == null) {
      entityObj = null;
      resolvedId = null;
      return;
    }

    resolvedId = numId;
    const cacheKey = `${fieldType}-${numId}`;
    const cached = entityCache.get(cacheKey);
    if (cached) {
      entityObj = cached;
      return;
    }

    const fetchId = numId;
    (async () => {
      try {
        let result: Station | Operator | Train | null = null;
        if (fieldType === 'station') {
          result = await api.station.get.query(fetchId);
        } else if (fieldType === 'operator') {
          result = await api.operator.get.query(fetchId);
        } else if (fieldType === 'train') {
          result = await api.train.get.query(fetchId);
        }
        // Only apply if this is still the latest request
        if (resolvedId !== fetchId) return;
        if (result) {
          entityCache.set(cacheKey, result);
          entityObj = result;
        }
      } catch {
        if (resolvedId === fetchId) entityObj = null;
      }
    })();
  });

  const onEntityChange = (entity: { id: number } | null) => {
    if (entity) {
      const obj = entity as Station | Operator | Train;
      entityCache.set(`${fieldType}-${entity.id}`, obj);
      entityObj = obj;
      resolvedId = entity.id;
      set(entity.id);
    } else {
      entityObj = null;
      resolvedId = null;
      set(null);
    }
  };
</script>

<div class="grid gap-1">
  <Label for={fieldId}>
    {label}{required ? ' *' : ''}
  </Label>

  {#if fieldType === 'text'}
    <Input
      id={fieldId}
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}
      placeholder="Enter value..."
    />
  {:else if fieldType === 'textarea'}
    <textarea
      id={fieldId}
      class="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}></textarea>
  {:else if fieldType === 'number'}
    <Input
      id={fieldId}
      type="number"
      value={value == null ? '' : String(value)}
      oninput={(e) => {
        const raw = e.currentTarget.value;
        const parsed = Number(raw);
        set(raw === '' || Number.isNaN(parsed) ? null : parsed);
      }}
      placeholder="Enter value..."
    />
  {:else if fieldType === 'boolean'}
    <Switch
      id={fieldId}
      checked={Boolean(value)}
      onCheckedChange={(checked) => set(checked)}
    />
  {:else if fieldType === 'date'}
    <Input
      id={fieldId}
      type="date"
      value={(value as string) ?? ''}
      oninput={(e) => set(e.currentTarget.value || null)}
    />
  {:else if fieldType === 'select'}
    <Select.Root
      type="single"
      value={(value as string) ?? ''}
      onValueChange={(v) => set(v || null)}
    >
      <Select.Trigger id={fieldId}>
        {(value as string) || 'Select option'}
      </Select.Trigger>
      <Select.Content>
        {#each resolvedOptions as option (option)}
          <Select.Item value={option} label={option} />
        {/each}
      </Select.Content>
    </Select.Root>
  {:else if fieldType === 'multi-select'}
    <Select.Root
      type="multiple"
      value={Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : []}
      onValueChange={(v) => set(v.length ? v : null)}
    >
      <Select.Trigger id={fieldId}>
        {Array.isArray(value) && value.length
          ? value.join(', ')
          : 'Select options'}
      </Select.Trigger>
      <Select.Content>
        {#each resolvedOptions as option (option)}
          <Select.Item value={option} label={option} />
        {/each}
      </Select.Content>
    </Select.Root>
  {:else if fieldType === 'station'}
    <StationPicker
      value={entityObj as Station | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {:else if fieldType === 'operator'}
    <OperatorPicker
      value={entityObj as Operator | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {:else if fieldType === 'train'}
    <TrainPicker
      value={entityObj as Train | null}
      compact
      onchange={(v) => onEntityChange(v)}
    />
  {/if}

  {#if error}
    <p class="text-destructive text-sm font-medium">{error}</p>
  {:else if description}
    <p class="text-muted-foreground text-xs">{description}</p>
  {/if}
</div>
