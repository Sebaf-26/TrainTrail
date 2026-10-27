<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import { page } from '$app/state';

  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import type { JourneyScope } from '$lib/journey-scope';
  import { journeyScopeState, setJourneyScope } from '$lib/state.svelte';

  const users = $derived(page.data.users);
  const selectedUserId = $derived(
    journeyScopeState.current.scope === 'user'
      ? journeyScopeState.current.userId
      : undefined,
  );

  const scopeLabel = $derived.by(() => {
    if (journeyScopeState.current.scope === 'all') return 'everyone';
    if (journeyScopeState.current.scope === 'user') {
      const scopedUser = users.find((u) => u.id === selectedUserId);
      return scopedUser?.displayName ?? 'selected user';
    }
    return 'you';
  });

  const updateScope = (scope: JourneyScope['scope']) => {
    const userId =
      journeyScopeState.current.scope === 'user'
        ? journeyScopeState.current.userId
        : users[0]?.id;
    if (scope === 'user') {
      if (userId) setJourneyScope({ scope, userId });
      return;
    }
    setJourneyScope({ scope });
  };
</script>

<div
  class="flex items-center gap-2 rounded-lg border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground"
>
  <Info class="size-4 shrink-0" />
  <span class="truncate">
    Showing journeys for <strong class="text-foreground">{scopeLabel}</strong>
  </span>
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" size="sm" class="ml-auto shrink-0">
          Change
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="end" class="w-[320px] space-y-3 p-3">
      <div>
        <p class="text-sm font-medium">Journey visibility</p>
      </div>
      <RadioGroup.Root
        value={journeyScopeState.current.scope}
        onValueChange={(value) => {
          if (value === 'mine' || value === 'user' || value === 'all') {
            updateScope(value);
          }
        }}
        class={`grid gap-2 ${users.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        <Label
          class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
        >
          <RadioGroup.Item value="mine" class="sr-only" />
          Mine
        </Label>
        {#if users.length > 0}
          <Label
            class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
          >
            <RadioGroup.Item value="user" class="sr-only" />
            User
          </Label>
        {/if}
        <Label
          class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
        >
          <RadioGroup.Item value="all" class="sr-only" />
          All
        </Label>
      </RadioGroup.Root>

      {#if journeyScopeState.current.scope === 'user' && users.length > 0}
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground">User</p>
          <Select.Root
            type="single"
            value={journeyScopeState.current.userId}
            onValueChange={(value) => {
              if (value) setJourneyScope({ scope: 'user', userId: value });
            }}
          >
            <Select.Trigger>
              {users.find((u) => u.id === selectedUserId)?.displayName ??
                'Select a user'}
            </Select.Trigger>
            <Select.Content>
              {#each users as user (user.id)}
                <Select.Item value={user.id} label={user.displayName} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
