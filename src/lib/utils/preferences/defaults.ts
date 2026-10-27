import type { Preferences } from '$lib/zod/user';

export const defaultPreferences: Preferences = {
  distanceUnit: 'km',
  timeFormat: 'auto',
  dateFormat: 'auto',
  weekStartsOn: 'auto',
  journeyTimeDisplay: 'station',
};

type UserLike = Partial<Preferences> | null | undefined;

export function getPreferences(user: UserLike): Preferences {
  if (!user) return defaultPreferences;
  return {
    distanceUnit: user.distanceUnit ?? defaultPreferences.distanceUnit,
    timeFormat: user.timeFormat ?? defaultPreferences.timeFormat,
    dateFormat: user.dateFormat ?? defaultPreferences.dateFormat,
    weekStartsOn: user.weekStartsOn ?? defaultPreferences.weekStartsOn,
    journeyTimeDisplay:
      user.journeyTimeDisplay ?? defaultPreferences.journeyTimeDisplay,
  };
}
