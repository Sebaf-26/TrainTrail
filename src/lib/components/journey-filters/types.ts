import type { CalendarDate } from '@internationalized/date';

export type Route = {
  a: string;
  b: string;
};

export type OptionFilterOperator = 'is' | 'is not' | 'is any of' | 'is none of';

export type MultiOptionFilterOperator =
  | 'include'
  | 'exclude'
  | 'include any of'
  | 'include all of'
  | 'include exactly'
  | 'exclude if any of'
  | 'exclude if all'
  | 'exclude exactly';

export type LocationFilterValues = {
  departureStations: string[];
  arrivalStations: string[];
  stationsEither: string[];
  routes: Route[];
};

export type LocationFilterOperators = {
  departureStationsOperator: OptionFilterOperator;
  arrivalStationsOperator: OptionFilterOperator;
};

export type JourneyFilters = LocationFilterValues &
  LocationFilterOperators & {
    years: string[];
    yearsOperator: OptionFilterOperator;
    fromDate: CalendarDate | undefined;
    toDate: CalendarDate | undefined;
    passengers: string[];
    passengersOperator: MultiOptionFilterOperator;
    operator: string[];
    operatorOperator: OptionFilterOperator;
    train: string[];
    trainOperator: OptionFilterOperator;
    unitNumbers: string[];
    unitNumbersOperator: OptionFilterOperator;
  };

export type TempFilters = LocationFilterValues;

export type LocationFilters = LocationFilterValues &
  Partial<LocationFilterOperators>;

export const createDefaultTempFilters = (): TempFilters => ({
  departureStations: [],
  arrivalStations: [],
  stationsEither: [],
  routes: [],
});

export const defaultTempFilters: TempFilters = createDefaultTempFilters();

export function normalizeRoute(idA: string, idB: string): Route {
  return idA <= idB ? { a: idA, b: idB } : { a: idB, b: idA };
}

export function routeMatchesEndpoints(
  fromId: string | number | null | undefined,
  toId: string | number | null | undefined,
  route: Route | null | undefined,
): boolean {
  if (fromId == null || toId == null || !route) return false;
  const from = fromId.toString();
  const to = toId.toString();
  return (
    (from === route.a && to === route.b) || (from === route.b && to === route.a)
  );
}

export function hasTempFilters(tempFilters: TempFilters | undefined): boolean {
  return !!(
    tempFilters &&
    (tempFilters.departureStations.length > 0 ||
      tempFilters.arrivalStations.length > 0 ||
      tempFilters.stationsEither.length > 0 ||
      tempFilters.routes.length > 0)
  );
}

export function clearTempFilters(tempFilters: TempFilters): void {
  tempFilters.departureStations = [];
  tempFilters.arrivalStations = [];
  tempFilters.stationsEither = [];
  tempFilters.routes = [];
}

export function setTempDepartureStation(
  tempFilters: TempFilters,
  stationId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.departureStations = [stationId];
}

export function setTempArrivalStation(
  tempFilters: TempFilters,
  stationId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.arrivalStations = [stationId];
}

export function setTempStationEither(
  tempFilters: TempFilters,
  stationId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.stationsEither = [stationId];
}

export function setTempRoute(tempFilters: TempFilters, route: Route): void {
  clearTempFilters(tempFilters);
  tempFilters.routes = [route];
}
