import type { ParsedTicket } from './types';

const digits = (value: string | null) => value?.replace(/\D/g, '') || null;

const sameStation = (a: string | null, b: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const sameLeg = (a: ParsedTicket, b: ParsedTicket) => {
  const sameDay = a.departure?.date === b.departure?.date;
  const trainA = digits(a.trainNumber);
  if (trainA && trainA === digits(b.trainNumber)) {
    return sameDay || !a.departure || !b.departure;
  }

  return (
    sameDay &&
    a.departure?.time === b.departure?.time &&
    sameStation(a.from, b.from) &&
    sameStation(a.to, b.to)
  );
};

/**
 * Combines tickets read from different parts of the same input (for example a
 * pass attached to an e-mail and the text of the e-mail). The first list wins;
 * tickets describing the same leg only add what is missing.
 */
export const mergeTickets = (...lists: ParsedTicket[][]): ParsedTicket[] => {
  const merged: ParsedTicket[] = [];

  for (const ticket of lists.flat()) {
    const existing = merged.find((candidate) => sameLeg(candidate, ticket));
    if (!existing) {
      merged.push({ ...ticket });
      continue;
    }

    for (const key of Object.keys(ticket) as (keyof ParsedTicket)[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existing as any)[key] ??= ticket[key];
    }
  }

  return merged;
};
