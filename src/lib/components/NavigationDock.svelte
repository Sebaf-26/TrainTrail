<script lang="ts">
  import {
    ChartColumn,
    GitBranchPlus,
    Grip,
    LayoutList,
    Map,
    Settings,
  } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    canDeduplicateOwnJourneys,
    hasClientPermission,
  } from '$lib/authorization/permissions';
  import {
    Dock,
    DockDropdownItem,
    DockFloatingItem,
    DockTooltipItem,
  } from '$lib/components/dock';
  import { Separator } from '$lib/components/ui/separator';
  import { openModalsState } from '$lib/state.svelte';
  import { flyAndScale } from '$lib/utils';

  const addJourneyItem = {
    label: 'Add journey',
    icon: GitBranchPlus,
    testId: 'add-journey-button',
    onClick: () => {
      openModalsState.addJourneyChoice = true;
    },
  };
  const listJourneysItem = {
    label: 'List journeys',
    icon: LayoutList,
    testId: 'list-journeys-button',
    onClick: () => {
      openModalsState.listJourneys = true;
    },
  };
  const journeysStatisticsItem = {
    label: 'Statistics',
    icon: ChartColumn,
    testId: 'statistics-button',
    onClick: () => {
      openModalsState.statistics = true;
    },
  };
  const settingsItem = {
    label: 'Settings',
    icon: Settings,
    id: 'settings-button',
    onClick: () => {
      openModalsState.settingsTab = 'general';
      openModalsState.settings = true;
    },
  };

  const otherItems = $derived.by(() => {
    const items = [];
    if (
      canDeduplicateOwnJourneys(page.data.authorization) ||
      hasClientPermission(page.data.authorization, 'tools.sql.execute')
    ) {
      items.push({ label: 'Tools', href: '/tools' });
    }
    if (hasClientPermission(page.data.authorization, 'journey.read.own')) {
      items.push({ label: 'Visited countries', href: '/visited-countries' });
    }
    return items;
  });
</script>

<nav
  aria-label="Main navigation"
  class="z-10 absolute bottom-6 left-1/2 translate-x-[-50%]"
>
  <div class="flex gap-4">
    {#if page.url.pathname !== '/'}
      <div transition:flyAndScale>
        <DockFloatingItem href="/" label="Home">
          <Map />
        </DockFloatingItem>
      </div>
    {/if}
    <Dock>
      {#if hasClientPermission(page.data.authorization, 'journey.create.own')}
        <DockTooltipItem item={addJourneyItem} />
      {/if}
      {#if page.url.pathname === '/' && hasClientPermission(page.data.authorization, 'journey.read.own')}
        <DockTooltipItem item={listJourneysItem} />
        <DockTooltipItem item={journeysStatisticsItem} />
      {/if}
      {#if otherItems.length > 0}
        <DockDropdownItem items={otherItems} label="More">
          <Grip />
        </DockDropdownItem>
      {/if}
      <Separator orientation="vertical" class="h-full w-px" />
      <DockTooltipItem item={settingsItem} />
    </Dock>
  </div>
</nav>
