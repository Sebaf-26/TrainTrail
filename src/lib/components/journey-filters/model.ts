import { CalendarDate } from '@internationalized/date';
import { isAfter, isBefore } from 'date-fns';
import type { FilterModel, FiltersState } from 'bits-ui';

import {
  routeMatchesEndpoints,
  type JourneyFilters,
  type LocationFilters,
  type MultiOptionFilterOperator,
  type OptionFilterOperator,
  type Route,
} from './types';

import { getJourneyPassengerToken, type JourneyData } from '$lib/utils';
import { parseLocalISO } from '$lib/utils/datetime';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';

export type FilterColumnId =
  | 'departureStations'
  | 'arrivalStations'
  | 'date'
  | 'passengers'
  | 'operator'
  | 'train'
  | 'unitNumbers';

export type OptionColumnId = Exclude<FilterColumnId, 'date'>;
export type NonPassengerOptionColumnId = Exclude<OptionColumnId, 'passengers'>;

export type OperatorChoice<TOperator extends string> = {
  value: TOperator;
  label: string;
};

export const optionOperators: ReadonlyArray<
  OperatorChoice<OptionFilterOperator>
> = [
  { value: 'is', label: 'Is' },
  { value: 'is not', label: 'Is not' },
  { value: 'is any of', label: 'Is any of' },
  { value: 'is none of', label: 'Is none of' },
];

export const singularOptionOperators = optionOperators.filter(
  (operator) => operator.value === 'is' || operator.value === 'is not',
);

export const pluralOptionOperators = optionOperators.filter(
  (operator) =>
    operator.value === 'is any of' || operator.value === 'is none of',
);

export const multiOptionOperators: ReadonlyArray<
  OperatorChoice<MultiOptionFilterOperator>
> = [
  { value: 'include', label: 'Include' },
  { value: 'exclude', label: 'Exclude' },
  { value: 'include any of', label: 'Include any of' },
  { value: 'include all of', label: 'Include all of' },
  { value: 'include exactly', label: 'Include exactly' },
  { value: 'exclude if any of', label: 'Exclude if any of' },
  { value: 'exclude if all', label: 'Exclude if all' },
  { value: 'exclude exactly', label: 'Exclude exactly' },
];

export const singularMultiOptionOperators = multiOptionOperators.filter(
  (operator) =>
    operator.value === 'include' ||
    operator.value === 'exclude' ||
    operator.value === 'include exactly' ||
    operator.value === 'exclude exactly',
);

export const pluralMultiOptionOperators = multiOptionOperators.filter(
  (operator) => operator.value !== 'include' && operator.value !== 'exclude',
);

export function createDefaultFilters(): JourneyFilters {
  return {
    departureStations: [],
    departureStationsOperator: 'is any of',
    arrivalStations: [],
    arrivalStationsOperator: 'is any of',
    stationsEither: [],
    routes: [],
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    operator: [],
    operatorOperator: 'is any of',
    train: [],
    trainOperator: 'is any of',
    unitNumbers: [],
    unitNumbersOperator: 'is any of',
  };
}

export function cloneJourneyFilters(
  source: JourneyFilters,
  next: Partial<JourneyFilters> = {},
): JourneyFilters {
  return {
    ...source,
    departureStations: [...source.departureStations],
    arrivalStations: [...source.arrivalStations],
    stationsEither: [...source.stationsEither],
    routes: source.routes.map((route) => ({ ...route })),
    years: [...source.years],
    passengers: [...source.passengers],
    operator: [...source.operator],
    train: [...source.train],
    unitNumbers: [...source.unitNumbers],
    ...next,
  };
}

export function hasJourneyFilters(
  filters: JourneyFilters | undefined,
): boolean {
  return !!(
    filters &&
    (filters.departureStations.length > 0 ||
      filters.arrivalStations.length > 0 ||
      filters.stationsEither.length > 0 ||
      filters.routes.length > 0 ||
      filters.years.length > 0 ||
      filters.fromDate ||
      filters.toDate ||
      filters.passengers.length > 0 ||
      filters.operator.length > 0 ||
      filters.train.length > 0 ||
      filters.unitNumbers.length > 0)
  );
}

export function normalizeOptionOperator(
  operator: OptionFilterOperator,
  valueCount: number,
): OptionFilterOperator {
  if (valueCount > 1) {
    if (operator === 'is') return 'is any of';
    if (operator === 'is not') return 'is none of';
    return operator;
  }

  if (operator === 'is any of') return 'is';
  if (operator === 'is none of') return 'is not';
  return operator;
}

export function normalizeMultiOptionOperator(
  operator: MultiOptionFilterOperator,
  valueCount: number,
): MultiOptionFilterOperator {
  if (valueCount > 1) {
    if (operator === 'include') return 'include any of';
    if (operator === 'exclude') return 'exclude if any of';
    return operator;
  }

  if (operator === 'exclude if any of' || operator === 'exclude if all') {
    return 'exclude';
  }

  if (operator === 'include any of' || operator === 'include all of') {
    return 'include';
  }

  return operator;
}

function setEquals(a: string[], b: string[]) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  return aSet.size === bSet.size && [...aSet].every((value) => bSet.has(value));
}

export function optionColumnValues(
  filters: JourneyFilters,
  columnId: OptionColumnId,
): string[] {
  return filters[columnId];
}

export function rawOptionColumnOperator(
  filters: JourneyFilters,
  columnId: 'passengers',
): MultiOptionFilterOperator;
export function rawOptionColumnOperator(
  filters: JourneyFilters,
  columnId: NonPassengerOptionColumnId,
): OptionFilterOperator;
export function rawOptionColumnOperator(
  filters: JourneyFilters,
  columnId: OptionColumnId,
): OptionFilterOperator | MultiOptionFilterOperator {
  switch (columnId) {
    case 'passengers':
      return filters.passengersOperator;
    case 'departureStations':
      return filters.departureStationsOperator;
    case 'arrivalStations':
      return filters.arrivalStationsOperator;
    case 'operator':
      return filters.operatorOperator;
    case 'train':
      return filters.trainOperator;
    case 'unitNumbers':
      return filters.unitNumbersOperator;
  }
}

export function optionColumnOperator(
  filters: JourneyFilters,
  columnId: 'passengers',
): MultiOptionFilterOperator;
export function optionColumnOperator(
  filters: JourneyFilters,
  columnId: NonPassengerOptionColumnId,
): OptionFilterOperator;
export function optionColumnOperator(
  filters: JourneyFilters,
  columnId: OptionColumnId,
): OptionFilterOperator | MultiOptionFilterOperator {
  const valueCount = optionColumnValues(filters, columnId).length;
  return columnId === 'passengers'
    ? normalizeMultiOptionOperator(filters.passengersOperator, valueCount)
    : normalizeOptionOperator(
        rawOptionColumnOperator(filters, columnId),
        valueCount,
      );
}

export function setOptionColumnOperator(
  filters: JourneyFilters,
  columnId: 'passengers',
  operator: MultiOptionFilterOperator,
): JourneyFilters;
export function setOptionColumnOperator(
  filters: JourneyFilters,
  columnId: NonPassengerOptionColumnId,
  operator: OptionFilterOperator,
): JourneyFilters;
export function setOptionColumnOperator(
  filters: JourneyFilters,
  columnId: OptionColumnId,
  operator: OptionFilterOperator | MultiOptionFilterOperator,
): JourneyFilters {
  switch (columnId) {
    case 'passengers':
      return cloneJourneyFilters(filters, {
        passengersOperator: operator as MultiOptionFilterOperator,
      });
    case 'departureStations':
      return cloneJourneyFilters(filters, {
        departureStationsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalStations':
      return cloneJourneyFilters(filters, {
        arrivalStationsOperator: operator as OptionFilterOperator,
      });
    case 'operator':
      return cloneJourneyFilters(filters, {
        operatorOperator: operator as OptionFilterOperator,
      });
    case 'train':
      return cloneJourneyFilters(filters, {
        trainOperator: operator as OptionFilterOperator,
      });
    case 'unitNumbers':
      return cloneJourneyFilters(filters, {
        unitNumbersOperator: operator as OptionFilterOperator,
      });
  }
}

function normalizeOperatorForCount(
  filters: JourneyFilters,
  columnId: OptionColumnId,
  valueCount: number,
) {
  if (columnId === 'passengers') {
    return normalizeMultiOptionOperator(filters.passengersOperator, valueCount);
  }

  return normalizeOptionOperator(
    rawOptionColumnOperator(filters, columnId),
    valueCount,
  );
}

export function setOptionColumnValues(
  filters: JourneyFilters,
  columnId: OptionColumnId,
  values: string[],
): JourneyFilters {
  const operator = normalizeOperatorForCount(filters, columnId, values.length);

  switch (columnId) {
    case 'passengers':
      return cloneJourneyFilters(filters, {
        passengers: values,
        passengersOperator: operator as MultiOptionFilterOperator,
      });
    case 'departureStations':
      return cloneJourneyFilters(filters, {
        departureStations: values,
        departureStationsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalStations':
      return cloneJourneyFilters(filters, {
        arrivalStations: values,
        arrivalStationsOperator: operator as OptionFilterOperator,
      });
    case 'operator':
      return cloneJourneyFilters(filters, {
        operator: values,
        operatorOperator: operator as OptionFilterOperator,
      });
    case 'train':
      return cloneJourneyFilters(filters, {
        train: values,
        trainOperator: operator as OptionFilterOperator,
      });
    case 'unitNumbers':
      return cloneJourneyFilters(filters, {
        unitNumbers: values,
        unitNumbersOperator: operator as OptionFilterOperator,
      });
  }
}

export function clearFilterColumn(
  filters: JourneyFilters,
  columnId: FilterColumnId,
): JourneyFilters {
  if (columnId === 'date') {
    return cloneJourneyFilters(filters, {
      years: [],
      fromDate: undefined,
      toDate: undefined,
    });
  }

  return setOptionColumnValues(filters, columnId, []);
}

export function isFilterColumnActive(
  filters: JourneyFilters,
  columnId: FilterColumnId,
): boolean {
  if (columnId === 'date') {
    return !!(filters.years.length || filters.fromDate || filters.toDate);
  }

  return optionColumnValues(filters, columnId).length > 0;
}

export function formatDateLabel(
  value: CalendarDate | undefined,
  prefs: Pick<Preferences, 'dateFormat'>,
) {
  if (!value) return '';
  return formatDate(new Date(value.year, value.month - 1, value.day), prefs);
}

export function dateFilterSummary(
  filters: JourneyFilters,
  prefs: Pick<Preferences, 'dateFormat'>,
) {
  if (filters.years.length) {
    if (filters.years.length <= 2) return filters.years.join(', ');
    return `${filters.years.slice(0, 2).join(', ')} +${filters.years.length - 2}`;
  }

  if (filters.fromDate && filters.toDate) {
    if (filters.fromDate.compare(filters.toDate) === 0) {
      return formatDateLabel(filters.fromDate, prefs);
    }
    return `${formatDateLabel(filters.fromDate, prefs)} - ${formatDateLabel(filters.toDate, prefs)}`;
  }
  if (filters.fromDate)
    return `From ${formatDateLabel(filters.fromDate, prefs)}`;
  if (filters.toDate) return `Until ${formatDateLabel(filters.toDate, prefs)}`;
  return 'Choose date';
}

function calendarDateToDate(value: CalendarDate) {
  return new Date(value.year, value.month - 1, value.day);
}

function dateToCalendarDate(value: Date) {
  return new CalendarDate(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
  );
}

function isSameCalendarDate(a: CalendarDate, b: CalendarDate) {
  return a.compare(b) === 0;
}

function isFullYearRange(fromDate?: CalendarDate, toDate?: CalendarDate) {
  if (!fromDate || !toDate || fromDate.year !== toDate.year) return false;
  return (
    fromDate.month === 1 &&
    fromDate.day === 1 &&
    toDate.month === 12 &&
    toDate.day === 31
  );
}

function normalizeDateRange(
  fromDate: CalendarDate,
  toDate: CalendarDate,
): [CalendarDate, CalendarDate] {
  return fromDate.compare(toDate) <= 0
    ? [fromDate, toDate]
    : [toDate, fromDate];
}

function stringValues(filter: FilterModel) {
  return filter.values
    .map((value) => (typeof value === 'string' ? value : undefined))
    .filter((value): value is string => !!value);
}

function firstDateValue(filter: FilterModel) {
  const value = filter.values[0];
  return value instanceof Date ? dateToCalendarDate(value) : undefined;
}

function optionFilter(
  columnId: string,
  values: string[],
  operator: OptionFilterOperator = values.length > 1 ? 'is any of' : 'is',
): FilterModel<'option'> | undefined {
  if (!values.length) return undefined;
  return {
    columnId,
    type: 'option',
    operator,
    values,
  };
}

function multiOptionFilter(
  columnId: string,
  values: string[],
  operator: MultiOptionFilterOperator = values.length > 1
    ? 'include any of'
    : 'include',
): FilterModel<'multiOption'> | undefined {
  if (!values.length) return undefined;
  return {
    columnId,
    type: 'multiOption',
    operator,
    values,
  };
}

function dateFilterFromJourneyFilters(
  source: JourneyFilters,
): FilterModel<'date'> | FilterModel<'option'> | undefined {
  if (source.years.length) {
    return {
      columnId: 'year',
      type: 'option',
      operator: source.yearsOperator,
      values: source.years,
    };
  }

  if (
    source.fromDate &&
    source.toDate &&
    isFullYearRange(source.fromDate, source.toDate)
  ) {
    return {
      columnId: 'year',
      type: 'option',
      operator: 'is',
      values: [source.fromDate.year.toString()],
    };
  }

  if (source.fromDate && source.toDate) {
    const [fromDate, toDate] = normalizeDateRange(
      source.fromDate,
      source.toDate,
    );

    if (isSameCalendarDate(fromDate, toDate)) {
      return {
        columnId: 'date',
        type: 'date',
        operator: 'is',
        values: [calendarDateToDate(fromDate)],
      };
    }

    return {
      columnId: 'date',
      type: 'date',
      operator: 'is between',
      values: [calendarDateToDate(fromDate), calendarDateToDate(toDate)],
    };
  }

  if (source.fromDate) {
    return {
      columnId: 'date',
      type: 'date',
      operator: 'is on or after',
      values: [calendarDateToDate(source.fromDate)],
    };
  }

  if (source.toDate) {
    return {
      columnId: 'date',
      type: 'date',
      operator: 'is on or before',
      values: [calendarDateToDate(source.toDate)],
    };
  }
}

export function journeyFiltersToBits(source: JourneyFilters): FiltersState {
  const nextFilters: FiltersState = [];

  for (const filter of [
    optionFilter(
      'departureStations',
      source.departureStations,
      source.departureStationsOperator,
    ),
    optionFilter(
      'arrivalStations',
      source.arrivalStations,
      source.arrivalStationsOperator,
    ),
    dateFilterFromJourneyFilters(source),
    multiOptionFilter(
      'passengers',
      source.passengers,
      source.passengersOperator,
    ),
    optionFilter('operator', source.operator, source.operatorOperator),
    optionFilter('train', source.train, source.trainOperator),
    optionFilter('unitNumbers', source.unitNumbers, source.unitNumbersOperator),
  ]) {
    if (filter) nextFilters.push(filter);
  }

  return nextFilters;
}

function applyDateFilter(target: JourneyFilters, filter: FilterModel) {
  if (filter.columnId !== 'date') return;

  const firstDate = firstDateValue(filter);
  const secondValue = filter.values[1];
  const secondDate =
    secondValue instanceof Date ? dateToCalendarDate(secondValue) : undefined;

  if (!firstDate) return;

  switch (filter.operator) {
    case 'is':
      target.fromDate = firstDate;
      target.toDate = firstDate;
      break;
    case 'is before':
      target.toDate = firstDate.subtract({ days: 1 });
      break;
    case 'is on or before':
      target.toDate = firstDate;
      break;
    case 'is after':
      target.fromDate = firstDate.add({ days: 1 });
      break;
    case 'is on or after':
      target.fromDate = firstDate;
      break;
    case 'is between':
      if (secondDate) {
        const [fromDate, toDate] = normalizeDateRange(firstDate, secondDate);
        target.fromDate = fromDate;
        target.toDate = toDate;
      }
      break;
  }
}

function resetBitsManagedFilters(base?: JourneyFilters): JourneyFilters {
  return cloneJourneyFilters(base ?? createDefaultFilters(), {
    departureStations: [],
    departureStationsOperator: 'is any of',
    arrivalStations: [],
    arrivalStationsOperator: 'is any of',
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    operator: [],
    operatorOperator: 'is any of',
    train: [],
    trainOperator: 'is any of',
    unitNumbers: [],
    unitNumbersOperator: 'is any of',
  });
}

export function bitsFiltersToJourneyFilters(
  source: FiltersState,
  base?: JourneyFilters,
): JourneyFilters {
  const nextFilters = resetBitsManagedFilters(base);
  const dateFilters: FilterModel[] = [];

  for (const filter of source) {
    switch (filter.columnId) {
      case 'departureStations':
        nextFilters.departureStations = stringValues(filter);
        nextFilters.departureStationsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'arrivalStations':
        nextFilters.arrivalStations = stringValues(filter);
        nextFilters.arrivalStationsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'passengers':
        nextFilters.passengers = stringValues(filter);
        nextFilters.passengersOperator =
          filter.operator as MultiOptionFilterOperator;
        break;
      case 'operator':
        nextFilters.operator = stringValues(filter);
        nextFilters.operatorOperator = filter.operator as OptionFilterOperator;
        break;
      case 'train':
        nextFilters.train = stringValues(filter);
        nextFilters.trainOperator = filter.operator as OptionFilterOperator;
        break;
      case 'unitNumbers':
        nextFilters.unitNumbers = stringValues(filter);
        nextFilters.unitNumbersOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'year':
        nextFilters.years = stringValues(filter);
        nextFilters.yearsOperator = normalizeOptionOperator(
          filter.operator as OptionFilterOperator,
          nextFilters.years.length,
        );
        break;
      case 'date':
        dateFilters.push(filter);
        break;
    }
  }

  dateFilters.forEach((filter) => applyDateFilter(nextFilters, filter));

  return nextFilters;
}

function serializeFilterValue(value: unknown) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
  }

  return String(value);
}

export function bitsSignature(source: FiltersState) {
  return JSON.stringify(
    source.map((filter) => ({
      columnId: filter.columnId,
      type: filter.type,
      operator: filter.operator,
      values: filter.values.map(serializeFilterValue),
    })),
  );
}

export function journeySignature(source: JourneyFilters) {
  return JSON.stringify({
    departureStations: source.departureStations,
    departureStationsOperator: source.departureStationsOperator,
    arrivalStations: source.arrivalStations,
    arrivalStationsOperator: source.arrivalStationsOperator,
    stationsEither: source.stationsEither,
    routes: source.routes,
    years: source.years,
    yearsOperator: source.yearsOperator,
    fromDate: source.fromDate?.toString(),
    toDate: source.toDate?.toString(),
    passengers: source.passengers,
    passengersOperator: source.passengersOperator,
    operator: source.operator,
    operatorOperator: source.operatorOperator,
    train: source.train,
    trainOperator: source.trainOperator,
    unitNumbers: source.unitNumbers,
    unitNumbersOperator: source.unitNumbersOperator,
  });
}

export function routeMatches(journey: JourneyData, route: Route): boolean {
  return routeMatchesEndpoints(journey.from?.id, journey.to?.id, route);
}

export function optionMatches(
  value: string | null | undefined,
  selectedValues: string[],
  operator: OptionFilterOperator = 'is any of',
) {
  if (!selectedValues.length) return true;

  const found = value ? selectedValues.includes(value) : false;

  switch (operator) {
    case 'is':
    case 'is any of':
      return found;
    case 'is not':
    case 'is none of':
      return !found;
  }
}

export function multiOptionMatches(
  values: string[],
  selectedValues: string[],
  operator: MultiOptionFilterOperator = 'include any of',
) {
  if (!selectedValues.length) return true;

  const present = new Set(values);
  const hasAny = selectedValues.some((value) => present.has(value));
  const hasAll = selectedValues.every((value) => present.has(value));

  switch (operator) {
    case 'include':
    case 'include any of':
      return hasAny;
    case 'exclude':
    case 'exclude if any of':
      return !hasAny;
    case 'include all of':
      return hasAll;
    case 'exclude if all':
      return !hasAll;
    case 'include exactly':
      return setEquals(values, selectedValues);
    case 'exclude exactly':
      return !setEquals(values, selectedValues);
  }
}

export function matchesLocationFilters(
  journey: JourneyData,
  locationFilters: LocationFilters,
) {
  const fromId = journey.from?.id.toString();
  const toId = journey.to?.id.toString();
  const departureStations = locationFilters.departureStations ?? [];
  const arrivalStations = locationFilters.arrivalStations ?? [];

  if (
    !optionMatches(
      fromId,
      departureStations,
      locationFilters.departureStationsOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      toId,
      arrivalStations,
      locationFilters.arrivalStationsOperator,
    )
  ) {
    return false;
  }

  if (
    locationFilters.stationsEither.length &&
    (!fromId ||
      !toId ||
      ![fromId, toId].some((id) => locationFilters.stationsEither.includes(id)))
  ) {
    return false;
  }

  if (
    locationFilters.routes.length &&
    !locationFilters.routes.some((route) => routeMatches(journey, route))
  ) {
    return false;
  }

  return true;
}

function getFilterBoundary(
  date: NonNullable<JourneyFilters['fromDate']>,
  tzId: string,
  end = false,
) {
  return parseLocalISO(
    `${date.toString()}T${end ? '23:59:59.999' : '00:00'}`,
    tzId,
  );
}

export function matchesNonLocationFilters(
  journey: JourneyData,
  filters: JourneyFilters,
) {
  if (
    !optionMatches(
      journey.date?.getFullYear().toString(),
      filters.years,
      filters.yearsOperator,
    )
  ) {
    return false;
  }

  if (
    filters.fromDate &&
    (!journey.dateEnd ||
      isBefore(
        journey.dateEnd,
        getFilterBoundary(filters.fromDate, journey.dateEnd.timeZone ?? 'UTC'),
      ))
  ) {
    return false;
  }

  if (
    filters.toDate &&
    (!journey.dateStart ||
      isAfter(
        journey.dateStart,
        getFilterBoundary(
          filters.toDate,
          journey.dateStart.timeZone ?? 'UTC',
          true,
        ),
      ))
  ) {
    return false;
  }

  if (
    !multiOptionMatches(
      journey.passengers
        .map((passenger) => getJourneyPassengerToken(passenger))
        .filter((token): token is string => !!token),
      filters.passengers,
      filters.passengersOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      journey.operator?.name,
      filters.operator,
      filters.operatorOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(journey.train?.name, filters.train, filters.trainOperator)
  ) {
    return false;
  }

  if (
    !optionMatches(
      journey.unitNumber,
      filters.unitNumbers,
      filters.unitNumbersOperator,
    )
  ) {
    return false;
  }

  return true;
}

export function matchesJourney(journey: JourneyData, filters: JourneyFilters) {
  return (
    matchesLocationFilters(journey, filters) &&
    matchesNonLocationFilters(journey, filters)
  );
}
