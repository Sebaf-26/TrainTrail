import { feetToMeters, kmToMiles } from './convert';

import type { Preferences } from '$lib/zod/user';
import type { JourneyDatePrecision } from '$lib/db/types';
import { getLocaleStartOfWeekDay } from '$lib/utils/datetime/helpers';

type DistancePrefs = Pick<Preferences, 'distanceUnit'>;
type AltitudePrefs = Pick<Preferences, 'distanceUnit'>;
type TimePrefs = Pick<Preferences, 'timeFormat'>;
type DatePrefs = Pick<Preferences, 'dateFormat'>;
type WeekStartPrefs = Pick<Preferences, 'weekStartsOn'>;
type JourneyTimePrefs = Pick<Preferences, 'journeyTimeDisplay'>;

// ----- Distance ---------------------------------------------------------

export const convertDistance = (km: number, prefs: DistancePrefs): number => {
  switch (prefs.distanceUnit) {
    case 'mi':
      return kmToMiles(km);
    case 'km':
    default:
      return km;
  }
};

export const distanceUnitLabel = (prefs: DistancePrefs): string => {
  switch (prefs.distanceUnit) {
    case 'mi':
      return 'mi';
    case 'km':
    default:
      return 'km';
  }
};

export const formatDistance = (
  km: number,
  prefs: DistancePrefs,
  opts: Intl.NumberFormatOptions = {},
): string => {
  const value = convertDistance(km, prefs);
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: prefs.distanceUnit === 'mi' ? 'mile' : 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
    ...opts,
  }).format(value);
};

// ----- Altitude ---------------------------------------------------------

export const convertAltitude = (feet: number, prefs: AltitudePrefs): number =>
  prefs.distanceUnit === 'km' ? feetToMeters(feet) : feet;

export const altitudeUnitLabel = (prefs: AltitudePrefs): 'm' | 'ft' =>
  prefs.distanceUnit === 'km' ? 'm' : 'ft';

// ----- Time / Date ------------------------------------------------------

const localeForDateFormat = (
  format: Preferences['dateFormat'],
): string | undefined => {
  switch (format) {
    case 'iso':
      return 'en-CA'; // YYYY-MM-DD with numeric short
    case 'us':
      return 'en-US';
    case 'eu':
      return 'en-GB';
    case 'auto':
    default:
      return undefined;
  }
};

const timeZoneFor = (date: Date, timeZone?: string): string | undefined =>
  timeZone ?? (date as Date & { timeZone?: string }).timeZone;

const dateParts = (date: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timeZoneFor(date, timeZone),
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
  };
};

export const formatTime = (
  date: Date,
  prefs: TimePrefs,
  timeZone?: string,
): string => {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
  };
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  if (resolvedTimeZone) opts.timeZone = resolvedTimeZone;
  if (prefs.timeFormat === '12h') opts.hour12 = true;
  else if (prefs.timeFormat === '24h') opts.hourCycle = 'h23';
  return new Intl.DateTimeFormat(undefined, opts).format(date);
};

export const formatDate = (
  date: Date,
  prefs: DatePrefs,
  timeZone?: string,
): string => {
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  if (prefs.dateFormat === 'iso') {
    const { year, month, day } = dateParts(date, resolvedTimeZone);
    return `${year}-${month}-${day}`;
  }
  const locale = localeForDateFormat(prefs.dateFormat);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: resolvedTimeZone,
  }).format(date);
};

export const formatJourneyDate = (
  date: Date,
  precision: JourneyDatePrecision,
  prefs: DatePrefs,
  timeZone?: string,
): string => {
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  if (precision === 'day') {
    return formatDate(date, prefs, resolvedTimeZone);
  }

  if (precision === 'year') {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: resolvedTimeZone,
    }).format(date);
  }

  if (prefs.dateFormat === 'iso') {
    const { year, month } = dateParts(date, resolvedTimeZone);
    return `${year}-${month}`;
  }

  return new Intl.DateTimeFormat(localeForDateFormat(prefs.dateFormat), {
    year: 'numeric',
    month: '2-digit',
    timeZone: resolvedTimeZone,
  }).format(date);
};

export const formatCompactDate = (
  date: Date,
  timeZone?: string,
  includeYear = false,
): string =>
  new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: includeYear ? 'numeric' : undefined,
    timeZone: timeZoneFor(date, timeZone),
  }).format(date);

export const formatCompactJourneyDate = (
  date: Date,
  precision: JourneyDatePrecision,
  timeZone?: string,
  includeYear = true,
): string => {
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  if (precision === 'day') {
    return formatCompactDate(date, resolvedTimeZone, includeYear);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: precision === 'month' ? 'short' : undefined,
    year: 'numeric',
    timeZone: resolvedTimeZone,
  }).format(date);
};

export const formatCompactDateWithWeekday = (
  date: Date,
  timeZone?: string,
): string => {
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    timeZone: resolvedTimeZone,
  }).format(date);
  return `${weekday}, ${formatCompactDate(date, resolvedTimeZone)}`;
};

export const formatDateWithWeekday = (
  date: Date,
  prefs: DatePrefs,
  timeZone?: string,
): string => {
  const resolvedTimeZone = timeZoneFor(date, timeZone);
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    timeZone: resolvedTimeZone,
  }).format(date);
  return `${weekday}, ${formatDate(date, prefs, resolvedTimeZone)}`;
};

export const formatDateTime = (
  date: Date,
  prefs: DatePrefs & TimePrefs,
  timeZone?: string,
): string =>
  `${formatDate(date, prefs, timeZone)} ${formatTime(date, prefs, timeZone)}`;

// ----- Week start -------------------------------------------------------

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Resolve `weekStartsOn` to a JS getDay() value (0=Sun..6=Sat).
 * For 'auto', uses the browser's locale; falls back to Monday on the server.
 */
export const getWeekStartsOn = (prefs: WeekStartPrefs): WeekDay => {
  if (prefs.weekStartsOn === 'mon') return 1;
  if (prefs.weekStartsOn === 'sun') return 0;
  if (typeof navigator === 'undefined') return 1;
  const localeIdentifier = navigator.language || 'en-US';
  return getLocaleStartOfWeekDay(localeIdentifier) as WeekDay;
};

// ----- Journey time display ----------------------------------------------

interface JourneyTzShape {
  from?: { tz: string } | null;
  to?: { tz: string } | null;
}

/**
 * Resolve which timezone to render a journey endpoint in, based on the user's
 * preference. Falls back through: requested endpoint → other endpoint → UTC.
 */
export const resolveJourneyTimeZone = (
  journey: JourneyTzShape,
  endpoint: 'departure' | 'arrival',
  prefs: JourneyTimePrefs,
): string => {
  if (prefs.journeyTimeDisplay === 'utc') return 'UTC';
  if (prefs.journeyTimeDisplay === 'system') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  const primary = endpoint === 'departure' ? journey.from?.tz : journey.to?.tz;
  return primary ?? journey.from?.tz ?? journey.to?.tz ?? 'UTC';
};

/**
 * Resolve the timezone the journey form should interpret its date/time inputs
 * in, given the user's `journeyTimeDisplay` preference. Falls back to the
 * provided station tz, then to UTC.
 */
export const resolveJourneyEditTimeZone = (
  prefs: JourneyTimePrefs,
  stationTz: string | null | undefined,
): string => {
  if (prefs.journeyTimeDisplay === 'utc') return 'UTC';
  if (prefs.journeyTimeDisplay === 'system') {
    return typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  }
  return stationTz ?? 'UTC';
};

/**
 * Pick an Intl locale appropriate for rendering 12h/24h time controls based on
 * the user's `timeFormat` preference. `auto` falls back to the browser locale.
 */
export const resolveTimeLocale = (prefs: TimePrefs): string => {
  if (prefs.timeFormat === '12h') return 'en-US';
  if (prefs.timeFormat === '24h') return 'fr-FR';
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : 'en-US';
};

/**
 * Pick an Intl locale that produces the user's preferred date segment order
 * (DD/MM, MM/DD, YYYY-MM-DD). `auto` falls back to the browser locale.
 */
export const resolveDateLocale = (prefs: DatePrefs): string => {
  const locale = localeForDateFormat(prefs.dateFormat);
  if (locale) return locale;
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : 'en-US';
};

/**
 * Re-express a (YYYY-MM-DD, HH:MM) pair from one timezone to another while
 * preserving the absolute moment they describe. Used by the journey form to
 * convert between station-local storage and the user's chosen display tz.
 */
export const reinterpretLocalDateTime = (
  date: string,
  time: string,
  fromTz: string,
  toTz: string,
): { date: string; time: string } => {
  if (fromTz === toTz) return { date, time };
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    h === undefined ||
    min === undefined ||
    [y, m, d, h, min].some((value) => Number.isNaN(value))
  ) {
    return { date, time };
  }
  // Find the UTC instant whose local representation in `fromTz` equals the
  // given fields. We use Intl to invert the tz offset rather than constructing
  // a TZDate (which would couple this helper to date-fns/tz).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fromTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const target = Date.UTC(y, m - 1, d, h, min);
  // Two-pass to account for DST: first guess, then refine by the offset error.
  const offsetAt = (utc: number): number => {
    const parts = fmt.formatToParts(new Date(utc));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUtc - utc;
  };
  let utc = target - offsetAt(target);
  utc = target - offsetAt(utc);
  const out = new Intl.DateTimeFormat('en-CA', {
    timeZone: toTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `hourCycle: 'h23'` is authoritative and guarantees 00–23 (so we never
    // see Safari's stray '24' for midnight). `hour12: false` is kept as a
    // belt-and-braces fallback for any runtime that doesn't honor hourCycle;
    // when both are set, hourCycle wins per the Intl spec.
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(new Date(utc));
  const p = (t: string) => out.find((part) => part.type === t)?.value ?? '';
  return {
    date: `${p('year')}-${p('month')}-${p('day')}`,
    time: `${p('hour')}:${p('minute')}`,
  };
};

/**
 * Translate a station-local (storedDate, storedTime) pair into editTz-local
 * values suitable for display. The date is returned as a "YYYY-MM-DDT00:00:00.000Z"
 * ISO string for compatibility with the form state shape; the time is "HH:MM".
 * Inputs pass through unchanged when conversion is unnecessary or impossible.
 */
export const pairToDisplay = (
  storedDate: string | null,
  storedTime: string | null,
  stationTz: string,
  editTz: string,
): { date: string | null; time: string | null } => {
  if (!storedDate || !storedTime || editTz === stationTz) {
    return { date: storedDate, time: storedTime };
  }
  const r = reinterpretLocalDateTime(
    storedDate.slice(0, 10),
    storedTime,
    stationTz,
    editTz,
  );
  return { date: `${r.date}T00:00:00.000Z`, time: r.time };
};

/**
 * Translate an editTz-local (date, time) pair into station-local storage
 * values. Callers must provide an anchor date — a time alone is ambiguous
 * once you account for cross-midnight tz shifts and DST.
 */
export const pairToStorage = (
  anchorDate: string,
  time: string,
  editTz: string,
  stationTz: string,
): { date: string; time: string } => {
  if (editTz === stationTz) {
    // Matches the journey-form storage shape: the date is stored as the day at
    // UTC midnight and the time as a separate "HH:MM" string, so any non-
    // midnight time component on `anchorDate` is intentionally discarded.
    return { date: `${anchorDate.slice(0, 10)}T00:00:00.000Z`, time };
  }
  const r = reinterpretLocalDateTime(
    anchorDate.slice(0, 10),
    time,
    editTz,
    stationTz,
  );
  return { date: `${r.date}T00:00:00.000Z`, time: r.time };
};
