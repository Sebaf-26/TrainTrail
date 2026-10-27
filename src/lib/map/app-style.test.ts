import { describe, expect, test } from 'vitest';

import {
  APP_STYLE_ROUTE_PATH,
  buildAppStyle,
  getConfiguredAppMapStyleUrl,
  getDefaultAppMapStyleUrl,
  isManagedAppMapStyleUrl,
} from './app-style';

describe('managed app map styles', () => {
  test('serves the app style from the app route', () => {
    expect(APP_STYLE_ROUTE_PATH).toBe('/api/map-styles/app/style.json');
  });

  test('includes the configuration revision in managed style URLs', () => {
    expect(getDefaultAppMapStyleUrl('dark', 'default', 7)).toBe(
      '/api/map-styles/app/style.json?theme=dark&v=7',
    );
    expect(getDefaultAppMapStyleUrl('light', 'satellite', 7)).toBe(
      '/api/map-styles/app/style.json?theme=light&v=7&basemap=satellite',
    );
  });

  test('preserves custom overrides but always manages satellite styles', () => {
    const config = {
      lightStyleUrl: 'https://maps.example.com/light.json',
      darkStyleUrl: null,
      styleRevision: 4,
    };

    expect(getConfiguredAppMapStyleUrl('light', config)).toBe(
      'https://maps.example.com/light.json',
    );
    expect(getConfiguredAppMapStyleUrl('dark', config)).toBe(
      '/api/map-styles/app/style.json?theme=dark&v=4',
    );
    expect(getConfiguredAppMapStyleUrl('light', config, 'satellite')).toBe(
      '/api/map-styles/app/style.json?theme=light&v=4&basemap=satellite',
    );
  });

  test('recognizes only managed style URLs', () => {
    expect(
      isManagedAppMapStyleUrl(getDefaultAppMapStyleUrl('light', 'default', 2)),
    ).toBe(true);
    expect(isManagedAppMapStyleUrl('https://maps.example.com/light.json')).toBe(
      false,
    );
  });
});

describe('buildAppStyle', () => {
  const providerStyle = {
    version: 8,
    name: 'Provider style',
    sources: { openmaptiles: { type: 'vector', url: 'https://example.com' } },
    layers: [
      { id: 'background', type: 'background' },
      { id: 'station', type: 'symbol', source: 'openmaptiles' },
    ],
  };

  test('keeps provider layers and sources untouched', () => {
    const style = buildAppStyle(providerStyle, {
      theme: 'light',
      fonts: { regular: ['Noto Sans Regular'], emphasis: ['Noto Sans Bold'] },
      creditsOpenStreetMap: true,
      provider: 'openfreemap',
    });

    expect(style.layers).toEqual(providerStyle.layers);
    expect(style.sources).toEqual(providerStyle.sources);
    expect(style).toMatchObject({ version: 8 });
  });

  test('does not mutate the provider style and names the result', () => {
    const light = buildAppStyle(providerStyle, { theme: 'light' });
    const dark = buildAppStyle(providerStyle, { theme: 'dark' });

    expect(providerStyle.name).toBe('Provider style');
    expect(light).not.toBe(providerStyle);
    expect(light.layers).not.toBe(providerStyle.layers);
    expect(light.name).toBe('TrainTrail Style');
    expect(dark.name).toBe('TrainTrail Style (Dark)');
  });
});
