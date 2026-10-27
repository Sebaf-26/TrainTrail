import {
  ContinentMap,
  JourneyReasons,
  SeatClasses,
  SeatTypes,
  type VisitedCountry,
  VisitedCountryStatus,
  wasVisited,
} from '$lib/db/types';
import { COUNTRIES } from '$lib/data/countries';
import { type JourneyData, toTitleCase } from '$lib/utils';
import {
  journeyReasonLabel,
  seatClassLabel,
  seatTypeLabel,
} from '$lib/utils/journey-labels';

const PASSENGER_LABELS = {
  seat: seatTypeLabel,
  seatClass: seatClassLabel,
  journeyReason: journeyReasonLabel,
} as const;

export type JourneyChartKey =
  | 'seat-class'
  | 'seat'
  | 'reason'
  | 'continents'
  | 'operators'
  | 'train-models'
  | 'unit-numbers'
  | 'stations'
  | 'routes';

export type CountryChartKey = 'visited-country-status';

export type CountryBarChartKey = 'countries-by-continent';

export type ChartKey = JourneyChartKey | CountryChartKey | CountryBarChartKey;

export type StatsContext = {
  // If omitted, aggregate for all users
  userId?: string;
};

export type AggregationOptions = {
  limit?: number; // if provided, return top N
};

export type VisitedCountryStats = Pick<
  VisitedCountry,
  'code' | 'status' | 'note'
>;

export function visitedCountryStatusDistribution(
  visitedCountries: VisitedCountryStats[],
): Record<string, number> {
  const counts = VisitedCountryStatus.reduce<Record<string, number>>(
    (acc, status) => {
      acc[toTitleCase(status)] = visitedCountries.filter(
        (c) => c.status === status,
      ).length;
      return acc;
    },
    {},
  );
  return counts;
}

export function countriesByContinentDistribution(
  visitedCountries: VisitedCountryStats[],
): Record<string, { visited: number; total: number }> {
  const continentByCode = new Map<string, string>();
  const result: Record<string, { visited: number; total: number }> = {};

  for (const country of COUNTRIES) {
    if (country.continent) {
      continentByCode.set(country.alpha2, country.continent);

      if (!result[country.continent]) {
        result[country.continent] = { visited: 0, total: 0 };
      }
      result[country.continent]!.total++;
    }
  }

  for (const visitedCountry of visitedCountries) {
    if (wasVisited(visitedCountry)) {
      const continent = continentByCode.get(visitedCountry.code);
      if (continent && result[continent]) {
        result[continent].visited++;
      }
    }
  }

  return result;
}

export type CountryDetail = {
  name: string;
  code: string;
  visited: boolean;
};

export function countriesByContinentDetails(
  visitedCountries: VisitedCountryStats[],
): Record<string, CountryDetail[]> {
  const visitedCodes: Set<string> = new Set();
  for (const country of visitedCountries) {
    if (wasVisited(country)) {
      visitedCodes.add(country.code);
    }
  }

  const result: Record<string, CountryDetail[]> = {};

  for (const country of COUNTRIES) {
    if (!country.continent) continue;

    if (!result[country.continent]) {
      result[country.continent] = [];
    }

    result[country.continent]!.push({
      name: country.name,
      code: country.alpha2,
      visited: visitedCodes.has(country.alpha2),
    });
  }

  for (const continent in result) {
    result[continent]!.sort((a, b) => {
      if (a.visited !== b.visited) {
        return a.visited ? -1 : 1; // visited first
      }
      return a.name.localeCompare(b.name); // alphabetically
    });
  }

  return result;
}

function sortAndLimit(
  counts: Record<string, number>,
  options?: AggregationOptions,
): Record<string, number> {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  if (!options?.limit || entries.length <= options.limit) {
    return Object.fromEntries(entries);
  }

  const top = entries.slice(0, options.limit);
  const others = entries
    .slice(options.limit)
    .reduce((acc, [, count]) => acc + count, 0);

  if (others > 0) {
    top.push(['Others', others]);
  }

  return Object.fromEntries(top);
}

/** The chart bucket key for a station: stations are identified by their name. */
export const codeForStation = (
  station: JourneyData['from'] | null | undefined,
) => station?.name || null;

export const routeLabelForJourney = (journey: JourneyData): string | null => {
  const fromCode = codeForStation(journey.from);
  const toCode = codeForStation(journey.to);
  if (!fromCode || !toCode) return null;
  return `${fromCode} → ${toCode}`;
};

export const journeyChartBucketForJourney = (
  journey: JourneyData,
  key: Exclude<JourneyChartKey, 'seat' | 'seat-class' | 'stations'>,
): string | null => {
  switch (key) {
    case 'operators':
      return journey.operator?.name ?? 'No Data';
    case 'train-models':
      return journey.train?.name ?? 'No Data';
    case 'unit-numbers':
      return journey.unitNumber ?? 'No Data';
    case 'reason':
      return null;
    case 'continents':
      return journey.to?.continent
        ? ContinentMap[journey.to.continent]
        : 'No Data';
    case 'routes':
      return routeLabelForJourney(journey);
  }
};

export const journeyMatchesChartBucket = (
  journey: JourneyData,
  chartKey: JourneyChartKey,
  bucket: string,
  ctx: StatsContext = {},
): boolean => {
  if (bucket === 'Others') return false;

  if (
    chartKey === 'seat' ||
    chartKey === 'seat-class' ||
    chartKey === 'reason'
  ) {
    const field =
      chartKey === 'seat'
        ? 'seat'
        : chartKey === 'seat-class'
          ? 'seatClass'
          : 'journeyReason';
    const passengers = ctx.userId
      ? journey.passengers.filter(
          (passenger) => passenger.userId === ctx.userId,
        )
      : journey.passengers;

    if (bucket === 'No Data') {
      if (ctx.userId) {
        return (
          passengers.length === 0 ||
          passengers.some((passenger) => !passenger[field])
        );
      }
      return passengers.some((passenger) => !passenger[field]);
    }

    return passengers.some(
      (seat) => seat[field] && PASSENGER_LABELS[field](seat[field]) === bucket,
    );
  }

  if (chartKey === 'stations') {
    return (
      codeForStation(journey.from) === bucket ||
      codeForStation(journey.to) === bucket
    );
  }

  return journeyChartBucketForJourney(journey, chartKey) === bucket;
};

export function seatDistribution(
  journeys: JourneyData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories: readonly string[] = SeatTypes;

  if (!ctx.userId) {
    const passengers = journeys.flatMap((journey) => journey.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[seatTypeLabel(category)] = passengers.filter(
          (seat) => seat.seat === category,
        ).length;
        return acc;
      },
      {},
    );

    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) {
      counts['No Data'] = noData;
    }

    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[seatTypeLabel(category)] = journeys.filter((f) =>
      f.passengers.some((v) => v.userId === ctx.userId && v.seat === category),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = journeys.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function seatClassDistribution(
  journeys: JourneyData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories: readonly string[] = SeatClasses;

  if (!ctx.userId) {
    const passengers = journeys.flatMap((journey) => journey.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[seatClassLabel(category)] = passengers.filter(
          (seat) => seat.seatClass === category,
        ).length;
        return acc;
      },
      {},
    );

    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) {
      counts['No Data'] = noData;
    }

    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[seatClassLabel(category)] = journeys.filter((f) =>
      f.passengers.some(
        (v) => v.userId === ctx.userId && v.seatClass === category,
      ),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = journeys.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function reasonDistribution(
  journeys: JourneyData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories: readonly string[] = JourneyReasons;

  if (!ctx.userId) {
    const passengers = journeys.flatMap((journey) => journey.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[journeyReasonLabel(category)] = passengers.filter(
          (passenger) => passenger.journeyReason === category,
        ).length;
        return acc;
      },
      {},
    );
    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) counts['No Data'] = noData;
    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[journeyReasonLabel(category)] = journeys.filter((journey) =>
      journey.passengers.some(
        (passenger) =>
          passenger.userId === ctx.userId &&
          passenger.journeyReason === category,
      ),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = journeys.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function continentDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const continents = Object.entries(ContinentMap).map(([code, name]) => ({
    code,
    name,
  }));
  const counts = continents.reduce<Record<string, number>>((acc, continent) => {
    acc[continent.name] = journeys.filter(
      (f) => f.to && f.to.continent === continent.code,
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = journeys.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function routeDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = journeys.reduce<Record<string, number>>((acc, journey) => {
    const label = routeLabelForJourney(journey);
    if (!label) return acc;

    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function operatorDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = journeys.reduce<Record<string, number>>((acc, journey) => {
    const label =
      journeyChartBucketForJourney(journey, 'operators') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function trainModelDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = journeys.reduce<Record<string, number>>((acc, journey) => {
    const label =
      journeyChartBucketForJourney(journey, 'train-models') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function unitNumberDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = journeys.reduce<Record<string, number>>((acc, journey) => {
    const label =
      journeyChartBucketForJourney(journey, 'unit-numbers') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function stationDistribution(
  journeys: JourneyData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { from, to } of journeys) {
    for (const code of [codeForStation(from), codeForStation(to)]) {
      if (!code) continue;

      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return sortAndLimit(counts, options);
}

export const JOURNEY_CHARTS: Record<
  JourneyChartKey,
  {
    title: string;
    aggregate: (
      journeys: JourneyData[],
      ctx: StatsContext,
      options?: AggregationOptions,
    ) => Record<string, number>;
  }
> = {
  'seat-class': { title: 'Seat Class', aggregate: seatClassDistribution },
  seat: { title: 'Seat Preference', aggregate: seatDistribution },
  reason: { title: 'Journey Reasons', aggregate: reasonDistribution },
  continents: { title: 'Continents', aggregate: continentDistribution },
  operators: { title: 'Operators', aggregate: operatorDistribution },
  'train-models': {
    title: 'Train Models',
    aggregate: trainModelDistribution,
  },
  'unit-numbers': {
    title: 'Specific Trains',
    aggregate: unitNumberDistribution,
  },
  stations: { title: 'Visited Stations', aggregate: stationDistribution },
  routes: { title: 'Routes', aggregate: routeDistribution },
};

export const COUNTRY_CHARTS: Record<
  CountryChartKey,
  {
    title: string;
    aggregate: (
      visitedCountries: VisitedCountryStats[],
    ) => Record<string, number>;
  }
> = {
  'visited-country-status': {
    title: 'Visited Country Status',
    aggregate: visitedCountryStatusDistribution,
  },
};

export const COUNTRY_BAR_CHARTS: Record<
  CountryBarChartKey,
  {
    title: string;
    aggregate: (
      visitedCountries: VisitedCountryStats[],
    ) => Record<string, { visited: number; total: number }>;
  }
> = {
  'countries-by-continent': {
    title: 'Countries by Continent',
    aggregate: countriesByContinentDistribution,
  },
};
