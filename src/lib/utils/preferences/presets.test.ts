import { describe, expect, it } from 'vitest';

import { defaultPreferences } from './defaults';
import { matchPreset, presetList, presets } from './presets';

describe('preference presets', () => {
  it('offers the metric and imperial presets only', () => {
    expect(presetList.map((preset) => preset.key)).toEqual([
      'metric',
      'imperial',
    ]);
  });

  it('matches preferences that equal a preset exactly', () => {
    expect(matchPreset(presets.metric.values)).toBe('metric');
    expect(matchPreset(presets.imperial.values)).toBe('imperial');
  });

  it('returns null for a custom mix', () => {
    expect(
      matchPreset({ ...presets.metric.values, distanceUnit: 'mi' }),
    ).toBeNull();
    expect(matchPreset(defaultPreferences)).toBeNull();
  });
});
