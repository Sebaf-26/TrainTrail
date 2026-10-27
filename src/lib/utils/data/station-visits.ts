import { formatCompactJourneyDate } from '$lib/utils/preferences';
import type { JourneyData } from './data';
import {
  getJourneyTimelineWindow,
  resolveJourneyTimeline,
} from './journey-timeline';

type Visit = { label: string; time: number };

export const getStationVisitSummary = (
  journeys: JourneyData[],
  stationId: number,
  now: Date,
) => {
  let last: Visit | null = null;
  let next: Visit | null = null;

  for (const journey of journeys) {
    const timeline = resolveJourneyTimeline(journey.raw);
    const windows = [
      journey.from?.id === stationId
        ? getJourneyTimelineWindow(timeline, 'departure')
        : null,
      journey.to?.id === stationId
        ? getJourneyTimelineWindow(timeline, 'arrival')
        : null,
    ];

    for (const window of windows) {
      if (!window) continue;
      const label = formatCompactJourneyDate(window.start, window.precision);

      if (window.end < now && (!last || window.end.getTime() > last.time)) {
        last = { label, time: window.end.getTime() };
      } else if (
        window.start > now &&
        (!next || window.start.getTime() < next.time)
      ) {
        next = { label, time: window.start.getTime() };
      }
    }
  }

  return { last: last?.label ?? null, next: next?.label ?? null };
};
