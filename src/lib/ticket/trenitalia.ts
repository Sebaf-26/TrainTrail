import { describeTrain } from './trains';
import {
  emptyTicket,
  type ParsedTicket,
  type ParseTicketResult,
  type SeatClass,
} from './types';

/**
 * Trenitalia tickets as PDF (the receipt of the app or the website). A page
 * holds one or two journeys, each introduced by "VIAGGIO da X a Y" ("TRAVEL from X
 * To Y" in the English version of the ticket); the PDF of
 * a trip with a change holds one journey per leg. Tickets for abroad have the
 * same fields with an English label next to the Italian one.
 */

const LEG_START = /^\s*(?:VIAGGIO\s+da|TRAVEL\s+from)\b/i;
const ITINERARY_START = /DETTAGLIO VIAGGIO\s*\/\s*ITINERARY DETAILS/i;
const LEG_END =
  /DETTAGLIO PASSEGGERI|PASSENGERS DETAILS|CONDIZIONI DI TRASPORTO|TRANSPORT CONDITIONS|^\s*(?:Pagina\s+\d+\s+di|Page\s+\d+\s+of)\s+\d+/i;

/** VIAGGIO da X a Y il 28/10/2021 alle ore 13:30 (the date may be "del", or missing). */
const HEADER =
  /(?:VIAGGIO\s+da|TRAVEL\s+from)\s+(.+?)\s+(?:a|to)\s+(.+?)(?:\s+(?:il|del|on)\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:alle\s*ore|at)\s*(\d{1,2}:\d{2}))?)?(?=\s{3,}|\s+(?:PNR|Codice|Entitlement)\b|\s*$)/i;

/** Ore 13:30 - 28/10/2021, also "Ore/Time 13:30 - ..." and "Hours 13:30 - ..." */
const STOP_TIME =
  /(?:Ore|Hours)(?:\s*\/\s*Time)?\s+(\d{1,2}:\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/g;

const columns = (text: string) =>
  text
    .split(/\s{3,}/)
    .map((column) => column.trim())
    .filter(Boolean);

const toDate = (day: string, month: string, year: string) =>
  `${year}-${month}-${day}`;

const toTime = (raw: string) => raw.padStart(5, '0');

export const seatClassOf = (service: string): SeatClass | null => {
  if (/cuccetta|couchette|vagone letto|sleeper/i.test(service))
    return 'sleeper';
  if (/business|executive/i.test(service)) return 'business';
  if (/premium/i.test(service)) return 'premium';
  if (/^\s*1\s*[°ªº]|prima|1st|first/i.test(service)) return 'first';
  if (/^\s*2\s*[°ªº]|seconda|standard|2nd|second/i.test(service)) {
    return 'second';
  }
  return null;
};

/** The first column that follows a label on its line, e.g. `Carrozza: 2`. */
const valueOf = (lines: string[], label: RegExp) => {
  for (const line of lines) {
    const match = label.exec(line);
    if (match) {
      return columns(line.slice(match.index + match[0].length))[0] ?? '';
    }
  }
  return null;
};

type Chunk = { lines: string[]; page: string[] };

/** Cuts the lines of a page into the journeys it holds. */
const chunksOf = (page: string[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let current: string[] | null = null;

  for (const line of page) {
    if (LEG_START.test(line) || ITINERARY_START.test(line)) {
      if (current) chunks.push({ lines: current, page });
      current = [line];
    } else if (current && LEG_END.test(line)) {
      chunks.push({ lines: current, page });
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (current) chunks.push({ lines: current, page });
  return chunks;
};

const readLeg = ({ lines, page }: Chunk): ParsedTicket | null => {
  const text = lines.join('\n');

  // A leg run by bus ("Bus: Autobus", "Servizio bus emesso per conto di ...")
  // is not a train journey.
  if (/^\s*Bus:/im.test(text) || /Servizio bus/i.test(text)) {
    return null;
  }
  const header = HEADER.exec(lines.slice(0, 2).join('   '));
  const stops = [...text.matchAll(STOP_TIME)];

  const ticket = emptyTicket('pdf');
  ticket.operatorName = 'Trenitalia';

  if (header) {
    ticket.from = header[1]!.trim();
    ticket.to = header[2]!.trim();
  }

  const [departure, arrival] = stops;
  if (departure) {
    ticket.departure = {
      date: toDate(departure[2]!, departure[3]!, departure[4]!),
      time: toTime(departure[1]!),
    };
  } else if (header?.[3]) {
    ticket.departure = {
      date: toDate(header[3], header[4]!, header[5]!),
      time: header[6] ? toTime(header[6]) : null,
    };
  }
  if (arrival) {
    ticket.arrival = {
      date: toDate(arrival[2]!, arrival[3]!, arrival[4]!),
      time: toTime(arrival[1]!),
    };
  }

  // Tickets for abroad name the stations in a column of their own, below the
  // heading "Stazione di Partenza/From".
  if (!ticket.from || !ticket.to) {
    const heading = lines.findIndex((line) =>
      /Stazione di Partenza|Departure station/i.test(line),
    );
    const names =
      heading >= 0
        ? columns(lines[heading + 2] ?? lines[heading + 1] ?? '')
        : [];
    ticket.from ??= names[0] ?? null;
    ticket.to ??= names[1] ?? null;
  }

  // "Treno: Frecciarossa  8623"; abroad the value is on the line below.
  const trainLine = lines.findIndex((line) =>
    /\b(?:Treno(?:\s*\/\s*Train)?|Train):/i.test(line),
  );
  if (trainLine >= 0) {
    const sameLine = valueOf(lines, /\b(?:Treno(?:\s*\/\s*Train)?|Train):\s*/i);
    const printed = sameLine
      ? columns(
          lines[trainLine]!.replace(
            /^.*?\b(?:Treno(?:\s*\/\s*Train)?|Train):/i,
            '',
          ),
        ).join(' ')
      : (columns(lines[trainLine + 1] ?? '').slice(-1)[0] ?? '');
    // Trenord runs regional trains that Trenitalia sells: "Regionale Trenord".
    if (/\btrenord\b/i.test(printed)) {
      ticket.operatorName = 'Trenord';
    }
    const train = describeTrain(printed.replace(/\s*\btrenord\b/i, ''));
    ticket.trainName = train.name;
    ticket.trainNumber = train.number;
  }

  const service = valueOf(
    lines,
    /\b(?:Servizio(?:\s*\/\s*Service)?|Service):\s*/i,
  );
  ticket.seatClass = service ? seatClassOf(service) : null;
  ticket.coach =
    valueOf(lines, /\b(?:Carrozza(?:\s*\/\s*Coach)?|Coaches?):\s*/i) || null;

  const seats = (valueOf(lines, /\b(?:Posti|Seats?):\s*/i) ?? '')
    .split(/[\s,]+/)
    .filter((seat) => /^\d+[A-Z]?$/i.test(seat));
  ticket.seat = seats[0] ?? null;
  ticket.details = seats.length > 1 ? `Seats ${seats.join(', ')}` : null;

  // A leg with a change has no PNR of its own: its ticket number stands in.
  const scopes = [text, page.join('\n')];
  for (const pattern of [
    /PNR:\s*([A-Z0-9]{5,8})\b/,
    /(?:Codice Biglietto|Ticket Code):\s*(\d+)/i,
    /(?:Numero Titolo|Titolo numero\s*\/\s*Title number|Entitlement Number):?\s*(\d+)/i,
  ]) {
    const code = scopes.map((scope) => pattern.exec(scope)?.[1]).find(Boolean);
    if (code) {
      ticket.bookingCode = code;
      break;
    }
  }

  return ticket.departure && ticket.from && ticket.to ? ticket : null;
};

const filledFields = (ticket: ParsedTicket) =>
  Object.values(ticket).filter((value) => value !== null).length;

/**
 * A seat reservation bought afterwards has a receipt of its own, with the same
 * "VIAGGIO da X a Y" heading as the ticket: it is the same journey, once.
 * The reading with more details is kept.
 */
const withoutDuplicates = (tickets: ParsedTicket[]) => {
  const kept = new Map<string, ParsedTicket>();
  for (const ticket of tickets) {
    const key = [
      ticket.departure?.date,
      ticket.departure?.time,
      ticket.from,
      ticket.to,
    ].join('|');
    const earlier = kept.get(key);
    if (!earlier || filledFields(ticket) > filledFields(earlier)) {
      kept.set(key, ticket);
    }
  }
  return [...kept.values()];
};

const isTrenitalia = (text: string) =>
  /trenitalia/i.test(text) &&
  (/VIAGGIO\s+da\b|TRAVEL\s+from\b/i.test(text) || ITINERARY_START.test(text));

/** Reads the journeys of a Trenitalia PDF ticket from the text of its pages. */
export const parseTrenitaliaPages = (
  pages: readonly string[],
): ParseTicketResult => {
  if (!isTrenitalia(pages.join('\n'))) {
    return { tickets: [], warnings: [] };
  }

  const tickets = withoutDuplicates(
    pages
      .flatMap((page) => chunksOf(page.split('\n')))
      .map(readLeg)
      .filter((ticket): ticket is ParsedTicket => ticket !== null),
  );

  return {
    tickets,
    warnings:
      tickets.length === 0
        ? ['No Trenitalia ticket was found in this PDF.']
        : [],
  };
};
