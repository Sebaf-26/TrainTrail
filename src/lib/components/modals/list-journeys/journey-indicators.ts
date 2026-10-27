import { getJourneyPassengerLabel, type JourneyData } from '$lib/utils';

export type JourneyIndicatorKey =
  'track' | 'actualTimes' | 'passengers' | 'note';

export type JourneyIndicator = {
  key: JourneyIndicatorKey;
  label: string;
};

const NOTE_PREVIEW_LENGTH = 160;

const indicator = (
  key: JourneyIndicatorKey,
  label: string,
): JourneyIndicator => ({ key, label });

const companionsOf = (journey: JourneyData, viewerId: string | null) => {
  if (!viewerId) {
    return journey.passengers.length > 1 ? journey.passengers : [];
  }
  return journey.passengers.filter(
    (passenger) => passenger.userId !== viewerId,
  );
};

const buildActualTimesIndicator = (
  journey: JourneyData,
): JourneyIndicator | null => {
  const hasDeparture = Boolean(journey.departure);
  const hasArrival = Boolean(journey.arrival);

  if (hasDeparture && hasArrival) {
    return indicator(
      'actualTimes',
      'Actual departure and arrival times recorded',
    );
  }
  if (hasDeparture) {
    return indicator('actualTimes', 'Actual departure time recorded');
  }
  if (hasArrival) {
    return indicator('actualTimes', 'Actual arrival time recorded');
  }
  return null;
};

const passengerCountLabel = (count: number) =>
  `${count} passenger${count === 1 ? '' : 's'} recorded`;

const buildPassengerIndicator = (
  journey: JourneyData,
  viewerId: string | null,
): JourneyIndicator | null => {
  const companions = companionsOf(journey, viewerId);
  if (!companions.length) return null;

  const names = companions
    .map((passenger) => getJourneyPassengerLabel(passenger))
    .filter((name): name is string => Boolean(name));
  if (!names.length) {
    return indicator('passengers', passengerCountLabel(companions.length));
  }

  const who = viewerId ? 'Also on board' : 'Passengers';
  const unnamedCount = companions.length - names.length;
  const unnamedSuffix = unnamedCount ? ` +${unnamedCount}` : '';
  return indicator('passengers', `${who}: ${names.join(', ')}${unnamedSuffix}`);
};

const buildNoteIndicator = (journey: JourneyData): JourneyIndicator | null => {
  const note = journey.note?.trim();
  if (!note) return null;

  const characters = Array.from(note);
  const preview =
    characters.length > NOTE_PREVIEW_LENGTH
      ? `${characters.slice(0, NOTE_PREVIEW_LENGTH).join('').trimEnd()}…`
      : note;
  return indicator('note', `Note: ${preview}`);
};

const isIndicator = (
  value: JourneyIndicator | null,
): value is JourneyIndicator => value !== null;

export const buildJourneyIndicators = (
  journey: JourneyData,
  {
    hasTrack = false,
    viewerId = null,
    includePassengers = true,
  }: {
    hasTrack?: boolean;
    viewerId?: string | null;
    includePassengers?: boolean;
  } = {},
): JourneyIndicator[] => {
  return [
    hasTrack ? indicator('track', 'Journey track recorded') : null,
    buildActualTimesIndicator(journey),
    includePassengers ? buildPassengerIndicator(journey, viewerId) : null,
    buildNoteIndicator(journey),
  ].filter(isIndicator);
};
