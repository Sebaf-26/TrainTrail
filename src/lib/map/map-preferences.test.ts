import { describe, expect, it } from 'vitest';

import {
  MAP_PREFERENCE_DEFAULTS,
  sanitizeMapPreferences,
} from './map-preferences.svelte';

describe('map preferences', () => {
  it('sanitizes every preference from the canonical definitions', () => {
    const preferences = sanitizeMapPreferences({
      projection: 'globe',
      routeDisplay: 'invalid',
    });

    expect(preferences.projection).toBe('globe');
    expect(preferences.routeDisplay).toBe(MAP_PREFERENCE_DEFAULTS.routeDisplay);
    expect(Object.keys(preferences)).toEqual(
      Object.keys(MAP_PREFERENCE_DEFAULTS),
    );
  });

  it('drops preferences that are no longer supported', () => {
    const preferences = sanitizeMapPreferences({
      projection: 'globe',
      stationOverlayDetail: 'standard',
      openAipEnabled: true,
      openAipGroups: ['stations'],
    });

    expect(preferences.projection).toBe('globe');
    expect(preferences).not.toHaveProperty('stationOverlayDetail');
    expect(preferences).not.toHaveProperty('openAipEnabled');
    expect(preferences).not.toHaveProperty('openAipGroups');
    expect(MAP_PREFERENCE_DEFAULTS).not.toHaveProperty('openAipEnabled');
  });
});
