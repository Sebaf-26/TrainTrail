import type { Preferences } from '$lib/zod/user';

export type PresetKey = 'metric' | 'imperial';

export interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  values: Preferences;
}

const JOURNEY_TIME_DISPLAY_DEFAULT: Preferences['journeyTimeDisplay'] =
  'station';

export const presets: Record<PresetKey, Preset> = {
  metric: {
    key: 'metric',
    label: 'Metric',
    description:
      'Kilometers, 24-hour clock, day-first dates. Common in most of the world.',
    values: {
      distanceUnit: 'km',
      timeFormat: '24h',
      dateFormat: 'eu',
      weekStartsOn: 'mon',
      journeyTimeDisplay: JOURNEY_TIME_DISPLAY_DEFAULT,
    },
  },
  imperial: {
    key: 'imperial',
    label: 'Imperial',
    description: 'Miles, 12-hour clock, month-first dates. Common in the US.',
    values: {
      distanceUnit: 'mi',
      timeFormat: '12h',
      dateFormat: 'us',
      weekStartsOn: 'sun',
      journeyTimeDisplay: JOURNEY_TIME_DISPLAY_DEFAULT,
    },
  },
};

export const presetList: Preset[] = [presets.metric, presets.imperial];

/**
 * Returns the key of the preset that matches the given preferences exactly,
 * or null if none do (i.e. the user has a custom mix).
 */
export const matchPreset = (prefs: Preferences): PresetKey | null => {
  for (const preset of presetList) {
    const v = preset.values;
    if (
      v.distanceUnit === prefs.distanceUnit &&
      v.timeFormat === prefs.timeFormat &&
      v.dateFormat === prefs.dateFormat &&
      v.weekStartsOn === prefs.weekStartsOn &&
      v.journeyTimeDisplay === prefs.journeyTimeDisplay
    ) {
      return preset.key;
    }
  }
  return null;
};
