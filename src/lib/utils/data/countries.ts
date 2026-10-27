import { COUNTRIES } from '$lib/data/countries';

export type Country = (typeof COUNTRIES)[number];

type JourneyCountryEndpoints = {
  from: { country: string } | null;
  to: { country: string } | null;
};

export const countryFromAlpha2 = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha2 === alpha);
};

export const isKnownCountryCode = (code: string) =>
  countryFromAlpha2(code) !== undefined;

export const countryCodesFromJourneys = (
  journeys: readonly JourneyCountryEndpoints[],
): Set<string> => {
  const countryCodes = new Set<string>();

  for (const journey of journeys) {
    for (const station of [journey.from, journey.to]) {
      if (station && countryFromAlpha2(station.country)) {
        countryCodes.add(station.country);
      }
    }
  }

  return countryCodes;
};
