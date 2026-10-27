import type { StationInput } from '@test/factories/stations';

export const MILANO_CENTRALE: StationInput = {
  code: 'test-milano-centrale',
  uic: '8301700',
  viaggiatrenoId: 'S01700',
  name: 'Milano Centrale',
  municipality: 'Milano',
  lat: 45.4859,
  lon: 9.2046,
  country: 'IT',
  continent: 'EU',
  tz: 'Europe/Rome',
  type: 'main',
};

export const ROMA_TERMINI: StationInput = {
  code: 'test-roma-termini',
  uic: '8308409',
  viaggiatrenoId: 'S08409',
  name: 'Roma Termini',
  municipality: 'Roma',
  lat: 41.9009,
  lon: 12.5016,
  country: 'IT',
  continent: 'EU',
  tz: 'Europe/Rome',
  type: 'main',
};

// A pair in different timezones, so the date and time tests can tell the
// departure and arrival offsets apart (Amtrak Lake Shore Limited).
export const NEW_YORK_PENN: StationInput = {
  code: 'test-new-york-penn',
  name: 'New York Penn Station',
  municipality: 'New York',
  lat: 40.7506,
  lon: -73.9935,
  country: 'US',
  continent: 'NA',
  tz: 'America/New_York',
  type: 'main',
};

export const CHICAGO_UNION: StationInput = {
  code: 'test-chicago-union',
  name: 'Chicago Union Station',
  municipality: 'Chicago',
  lat: 41.8786,
  lon: -87.6402,
  country: 'US',
  continent: 'NA',
  tz: 'America/Chicago',
  type: 'main',
};
