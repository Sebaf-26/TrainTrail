import {
  emptyTicket,
  type ParsedTicket,
  type ParseTicketResult,
  type SeatClass,
} from './types';

/**
 * ÖBB tickets as PDF ("Fahrschein + Reservierung", also Nightjet): a table
 * with date, time, from, to and class, the train and coach below it, the seats
 * or berths, and the ticket code. One page is one leg of the journey.
 */

const HEADER = /DATUM\s+ZEIT\s+VON\s*->?\s*NACH/i;

/** DD.MM time from -> to DD.MM time class */
const JOURNEY_ROW =
  /(\d{1,2})\.(\d{1,2})\.?\s+(\d{1,2}[:.]\d{2})\s+(.+?)\s*->\s*(.+?)\s+(\d{1,2})\.(\d{1,2})\.?\s+(\d{1,2}[:.]\d{2})\s+(\d)\b/;

const TRAIN = /\bZUG\s+(\d+)\s+([A-Z]{1,4})\b/;
const COACH = /\bWAGEN\s+(\d+)\s+(?:Sitz|Liege|Schlaf)\w*/i;
const TICKET_CODE =
  /Ticketcode\s+(?:\d{4}\s?){4}\s*zur\s+Buchung\s+((?:\d{4}\s?){4})/i;
const PASSENGER_KIND =
  /^\d{2}\s+(?:ERWACHSENE|KIND|KINDER|JUGENDLICHE|SENIOR|SENIORIN|ERM[ÄA]SSIGT)/i;
const SEAT_LABEL = /\b(FENSTER|GANG|MITTE|MITTEL|OBEN|UNTEN)\b/gi;
const END_OF_SEATS =
  /BEF[ÖO]RDERER|Sparschiene|Flexpreis|Super Sparschiene|PREIS|Umtausch/i;

const TRAIN_NAMES: Record<string, string> = {
  NJ: 'Nightjet',
  EN: 'EuroNight',
  RJX: 'Railjet Xpress',
  RJ: 'Railjet',
  EC: 'EuroCity',
  EST: 'Eurostar',
  IC: 'InterCity',
  ICE: 'ICE',
  REX: 'Regionalexpress',
};

const pad = (value: string | number) => String(value).padStart(2, '0');

const toTime = (raw: string) => {
  const [hours, minutes] = raw.split(/[:.]/);
  return `${pad(hours!)}:${minutes}`;
};

/** Dates on the ticket have no year: it is the one the ticket is valid for. */
const toDate = (day: string, month: string, year: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

const seatTypeOf = (label: string | undefined): ParsedTicket['seatType'] => {
  switch (label?.toUpperCase()) {
    case 'FENSTER':
      return 'window';
    case 'GANG':
      return 'aisle';
    case undefined:
      return null;
    default:
      return 'other';
  }
};

const POSITIONS: Record<string, string> = {
  FENSTER: 'window',
  GANG: 'aisle',
  OBEN: 'upper',
  UNTEN: 'lower',
  MITTE: 'middle',
  MITTEL: 'middle',
};

const positionOf = (label: string) =>
  POSITIONS[label.toUpperCase()] ?? label.toLowerCase();

type Seats = {
  numbers: string[];
  labels: string[];
  /** Words that describe the accommodation, e.g. "Mini Cabin". */
  place: string | null;
};

/** The seat or berth numbers and their position, in the lines below the coach. */
const readSeats = (lines: string[], coachLine: number): Seats => {
  const numbers: string[] = [];
  const labels: string[] = [];
  const places: string[] = [];

  for (const line of lines.slice(coachLine + 1, coachLine + 5)) {
    if (END_OF_SEATS.test(line)) {
      break;
    }
    for (const match of line.matchAll(SEAT_LABEL)) {
      labels.push(match[1]!.toUpperCase());
    }
    const rest = line.replace(SEAT_LABEL, ' ');
    for (const match of rest.matchAll(/\b\d{1,3}\b/g)) {
      numbers.push(match[0]);
    }
    const words = rest
      .replace(/\b\d{1,3}\b/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (words) {
      places.push(words);
    }
  }

  return { numbers, labels, place: places[0] ?? null };
};

/**
 * "Seats 93 (window), 94 (aisle)": the seats beyond the first one are kept in
 * the note. When the labels are fewer than the numbers (one "OBEN" over two
 * berths) they are not matched to a number, only listed once.
 */
const describeSeats = ({ numbers, labels, place }: Seats) => {
  let seats = '';
  if (numbers.length > 0) {
    const perSeat = labels.length === numbers.length;
    seats = `Seats ${numbers
      .map((number, index) =>
        perSeat ? `${number} (${positionOf(labels[index]!)})` : number,
      )
      .join(', ')}`;
    if (!perSeat && labels.length > 0) {
      seats += ` (${[...new Set(labels.map(positionOf))].join('/')})`;
    }
  }
  return [place, seats || null].filter(Boolean).join(' · ');
};

const passengerName = (lines: string[]) => {
  const kind = lines.findIndex((line) => PASSENGER_KIND.test(line.trim()));
  for (const line of lines.slice(0, Math.max(kind, 1))) {
    // The name stands in the right column, after the title of the ticket.
    const columns = line.split(/\s{3,}/);
    if (columns.length > 1) {
      return columns[columns.length - 1]!.trim() || null;
    }
  }
  const above = kind > 0 ? lines[kind - 1]!.split(/\s{3,}/).pop() : null;
  return above?.trim() || null;
};

const readPage = (
  text: string,
  options: { now?: Date },
): ParsedTicket | null => {
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  if (!HEADER.test(text)) {
    return null;
  }
  const row = JOURNEY_ROW.exec(text);
  if (!row) {
    return null;
  }
  const [
    ,
    day,
    month,
    time,
    from,
    to,
    arrivalDay,
    arrivalMonth,
    arrivalTime,
    klasse,
  ] = row as unknown as string[];

  const validFor = /G[üu]ltig:\s*(\d{4})/i.exec(text);
  const year = validFor
    ? Number(validFor[1])
    : (options.now ?? new Date()).getFullYear();
  const arrivalYear = Number(arrivalMonth) < Number(month) ? year + 1 : year;

  const ticket = emptyTicket('pdf');
  ticket.operatorName = /ÖBB|oebb\.at/i.test(text) ? 'ÖBB' : null;
  ticket.from = from!.trim();
  ticket.to = to!.trim();
  ticket.departure = { date: toDate(day!, month!, year), time: toTime(time!) };
  ticket.arrival = {
    date: toDate(arrivalDay!, arrivalMonth!, arrivalYear),
    time: toTime(arrivalTime!),
  };
  ticket.seatClass = (klasse === '1' ? 'first' : 'second') satisfies SeatClass;

  const train = TRAIN.exec(text);
  if (train) {
    ticket.trainNumber = `${train[2]} ${train[1]}`;
    ticket.trainName = TRAIN_NAMES[train[2]!] ?? null;
  }

  const coachLine = lines.findIndex((line) => COACH.test(line));
  if (coachLine >= 0) {
    ticket.coach = COACH.exec(lines[coachLine]!)![1]!;
    const seats = readSeats(lines, coachLine);
    ticket.seat = seats.numbers[0] ?? null;
    ticket.seatType = seatTypeOf(seats.labels[0]);
    ticket.details = describeSeats(seats) || null;
  }

  const code = TICKET_CODE.exec(text);
  ticket.bookingCode = code ? code[1]!.trim().replace(/\s+/g, ' ') : null;
  ticket.passengerName = passengerName(lines);

  return ticket;
};

/**
 * Reads the legs of an ÖBB ticket from the text of its pages. Pages that are
 * not a ticket (conditions, advertising) are skipped.
 */
export const parseOebbPages = (
  pages: readonly string[],
  options: { now?: Date } = {},
): ParseTicketResult => {
  const tickets = pages
    .map((page) => readPage(page, options))
    .filter((ticket): ticket is ParsedTicket => ticket !== null);

  return {
    tickets,
    warnings:
      tickets.length === 0 ? ['No ÖBB ticket was found in this PDF.'] : [],
  };
};
