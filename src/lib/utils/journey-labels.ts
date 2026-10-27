import { toTitleCase } from '$lib/utils';

/** User-facing labels for the passenger enums stored on a journey. */

export const seatTypeLabels: Record<string, string> = {
  window: 'Window',
  aisle: 'Aisle',
  table: 'Table',
  standing: 'Standing',
  other: 'Other',
};

export const seatClassLabels: Record<string, string> = {
  second: '2nd class',
  first: '1st class',
  business: 'Business',
  premium: 'Premium',
  sleeper: 'Sleeper',
};

export const journeyReasonLabels: Record<string, string> = {
  leisure: 'Leisure',
  business: 'Business',
  commute: 'Commute',
  other: 'Other',
};

export const seatTypeLabel = (value: string) =>
  seatTypeLabels[value] ?? toTitleCase(value);

export const seatClassLabel = (value: string) =>
  seatClassLabels[value] ?? toTitleCase(value);

export const journeyReasonLabel = (value: string) =>
  journeyReasonLabels[value] ?? toTitleCase(value);

/** Formats a platform for display, e.g. `7` becomes `Platform 7`. */
export const platformLabel = (platform: string | null | undefined) => {
  const value = platform?.trim();
  return value ? `Platform ${value}` : null;
};

/**
 * Inserts a space between a train category and its number, e.g. `FR9600`
 * becomes `FR 9600`. Values without that shape are returned trimmed.
 */
export const formatTrainNumberLabel = (
  trainNumber: string | null | undefined,
) => {
  const value = trainNumber?.trim();
  if (!value) return null;
  return value.replace(/^([a-zA-Z]+)(\d+)$/, '$1 $2');
};
