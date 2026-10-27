import type { JourneyData } from '$lib/utils';
import {
  isCompletedJourney,
  resolveJourneyTimeline,
} from '$lib/utils/data/journey-timeline';

/** Time spent changing trains under which two legs still read as one trip rather than two. */
export const MAX_LAYOVER_HOURS = 12;

const MAX_LAYOVER_MS = MAX_LAYOVER_HOURS * 60 * 60 * 1000;

/** Bucket for journeys that only have a placeholder date. */
const UNDATED_YEAR = 0;

/** A run of legs connected by a change of train, drawn as one uninterrupted block. */
export type LayoverGroup<T> = {
  key: string;
  /** The last upcoming journey sits directly above this group. */
  startsPastSection: boolean;
  journeys: T[];
};

export type JourneyListYear<T> = {
  /** `UNDATED_YEAR` for journeys without a date. */
  year: number;
  groups: LayoverGroup<T>[];
};

export type JourneyListPage<T> = {
  /** Zero-based index of the first journey in the complete sorted list. */
  firstJourneyIndex: number;
  journeys: T[];
  years: JourneyListYear<T>[];
};

/**
 * Sorts newest first on the best known departure time. Actual times are only
 * recorded once a journey has been completed, so upcoming ones have to be ordered on
 * their scheduled time rather than on the start of their day. Journeys without
 * any usable date sink to the bottom, where their year bucket renders.
 */
export const sortByDepartureDesc = <T extends JourneyData>(
  journeys: T[],
): T[] =>
  journeys
    .map((journey) => ({
      journey,
      at:
        (
          resolveJourneyTimeline(journey.raw).effectiveDeparture ??
          journey.dateStart
        )?.getTime() ?? null,
    }))
    .sort((a, b) => {
      if (a.at === null || b.at === null) {
        return (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0);
      }
      return b.at - a.at;
    })
    .map(({ journey }) => journey);

/**
 * True when `later` leaves from where `earlier` arrived, soon enough to be a
 * connection. Both times must be known: a same-day pair without times is just as
 * likely to be two unrelated journeys.
 */
const isLayover = (earlier: JourneyData, later: JourneyData) => {
  if (!earlier.to || !later.from || earlier.to.id !== later.from.id) {
    return false;
  }

  const { effectiveArrival } = resolveJourneyTimeline(earlier.raw);
  const { effectiveDeparture } = resolveJourneyTimeline(later.raw);
  if (!effectiveArrival || !effectiveDeparture) return false;

  const gap = effectiveDeparture.getTime() - effectiveArrival.getTime();
  return gap >= 0 && gap < MAX_LAYOVER_MS;
};

/** Id of the first journey that has already happened, if upcoming ones precede it. */
const findPastSectionStart = (journeys: JourneyData[], now: Date) => {
  let seenUpcoming = false;

  for (const journey of journeys) {
    if (!isCompletedJourney(journey.raw, now)) {
      seenUpcoming = true;
    } else if (seenUpcoming) {
      return journey.id;
    }
  }

  return null;
};

const groupByLayover = <T extends JourneyData>(
  journeys: T[],
  pastSectionStart: number | null,
): LayoverGroup<T>[] => {
  const groups: LayoverGroup<T>[] = [];

  for (const journey of journeys) {
    const startsPastSection = journey.id === pastSectionStart;
    const openGroup = groups.at(-1);
    // Newest first, so the journey already in the group is the later leg.
    const laterLeg = openGroup?.journeys.at(-1);

    // The upcoming/past boundary always breaks the run, so that a group never
    // straddles the divider drawn between the two sections.
    if (
      openGroup &&
      laterLeg &&
      !startsPastSection &&
      isLayover(journey, laterLeg)
    ) {
      openGroup.journeys.push(journey);
      continue;
    }

    groups.push({
      key: `layover-group-${journey.id}`,
      startsPastSection,
      journeys: [journey],
    });
  }

  return groups;
};

/**
 * Render model for the journey list: years newest first, each split into connection
 * groups, with the upcoming/past boundary marked on the group that follows it.
 * `journeys` must already be sorted newest first.
 */
export const buildJourneyListYears = <T extends JourneyData>(
  journeys: T[],
  now: Date,
): JourneyListYear<T>[] => {
  const byYear = new Map<number, T[]>();

  for (const journey of journeys) {
    const year = journey.date?.getFullYear() ?? UNDATED_YEAR;
    const bucket = byYear.get(year);
    if (bucket) bucket.push(journey);
    else byYear.set(year, [journey]);
  }

  const years = [...byYear.entries()].sort(([a], [b]) => b - a);
  // Undated journeys sink to the bottom, so the boundary has to be resolved on
  // the rendered order instead of the incoming one.
  const pastSectionStart = findPastSectionStart(
    years.flatMap(([, yearJourneys]) => yearJourneys),
    now,
  );

  return years.map(([year, yearJourneys]) => ({
    year,
    groups: groupByLayover(yearJourneys, pastSectionStart),
  }));
};

/** Packs complete connection groups into pages without losing divider metadata. */
export const paginateJourneyListYears = <T>(
  years: JourneyListYear<T>[],
  pageSize: number,
): JourneyListPage<T>[] => {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive integer');
  }

  const pages: JourneyListPage<T>[] = [];
  let currentPage: JourneyListPage<T> | null = null;
  let journeysBeforePage = 0;

  const finishPage = () => {
    if (!currentPage) return;
    pages.push(currentPage);
    journeysBeforePage += currentPage.journeys.length;
    currentPage = null;
  };

  for (const year of years) {
    for (const group of year.groups) {
      if (
        currentPage &&
        currentPage.journeys.length > 0 &&
        currentPage.journeys.length + group.journeys.length > pageSize
      ) {
        finishPage();
      }

      currentPage ??= {
        firstJourneyIndex: journeysBeforePage,
        journeys: [],
        years: [],
      };

      let pageYear = currentPage.years.at(-1);
      if (!pageYear || pageYear.year !== year.year) {
        pageYear = { year: year.year, groups: [] };
        currentPage.years.push(pageYear);
      }

      pageYear.groups.push(group);
      currentPage.journeys.push(...group.journeys);
    }
  }

  finishPage();
  return pages;
};
