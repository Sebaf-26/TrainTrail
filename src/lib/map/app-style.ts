import { normalizeMapTheme, type MapProvider } from '$lib/map/basemap';
import type { MapBasemap } from './basemap';

export const APP_STYLE_ROUTE_PATH = '/api/map-styles/app/style.json';

type AppStyleDocument = {
  name?: string;
  sources?: Record<string, Record<string, unknown>>;
  layers?: Array<Record<string, unknown>>;
};

export type AppStyleTheme = 'light' | 'dark';

export type AppStyleFonts = {
  regular: readonly string[];
  emphasis: readonly string[];
};

export type AppStyleProvider = MapProvider | 'local';

type AppMapConfig = {
  lightStyleUrl?: string | null;
  darkStyleUrl?: string | null;
  styleRevision?: number;
};

/**
 * Returns a copy of the provider's base style with the TrainTrail style name.
 * Provider layers and sources are kept as-is; no overlay is added. The
 * `fonts`, `creditsOpenStreetMap` and `provider` options describe the resolved
 * provider and are accepted so callers can pass the whole resolved style.
 */
export const buildAppStyle = (
  style: Record<string, unknown>,
  {
    theme = 'light',
  }: {
    theme?: AppStyleTheme;
    fonts?: AppStyleFonts;
    creditsOpenStreetMap?: boolean;
    provider?: AppStyleProvider;
  } = {},
) => {
  const appStyle = structuredClone(style) as AppStyleDocument;
  appStyle.name =
    theme === 'dark' ? 'TrainTrail Style (Dark)' : 'TrainTrail Style';

  return appStyle;
};

export const getDefaultAppMapStyleUrl = (
  theme?: string,
  basemap: MapBasemap = 'default',
  configRevision = 0,
) => {
  const normalizedTheme = normalizeMapTheme(theme);
  const params = new URLSearchParams({ theme: normalizedTheme });
  if (configRevision > 0) {
    params.set('v', String(configRevision));
  }
  if (basemap === 'satellite') {
    params.set('basemap', 'satellite');
  }

  return `${APP_STYLE_ROUTE_PATH}?${params}`;
};

export const getConfiguredAppMapStyleUrl = (
  theme?: string,
  config?: AppMapConfig | null,
  basemap: MapBasemap = 'default',
) => {
  const normalizedTheme = normalizeMapTheme(theme);
  const configRevision = config?.styleRevision ?? 0;
  if (basemap === 'satellite') {
    return getDefaultAppMapStyleUrl(normalizedTheme, basemap, configRevision);
  }

  if (normalizedTheme === 'dark') {
    return (
      config?.darkStyleUrl ||
      getDefaultAppMapStyleUrl(normalizedTheme, basemap, configRevision)
    );
  }

  return (
    config?.lightStyleUrl ||
    getDefaultAppMapStyleUrl(normalizedTheme, basemap, configRevision)
  );
};

export const isManagedAppMapStyleUrl = (styleUrl: string) =>
  styleUrl.startsWith(`${APP_STYLE_ROUTE_PATH}?`);
