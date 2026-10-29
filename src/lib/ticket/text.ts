import { CODE_BY_TRAIN_NAME, TRAIN_CODES } from './trains';
import {
  emptyTicket,
  type ParsedTicket,
  type SeatClass,
  type TicketSource,
} from './types';

const MONTHS: Record<string, number> = {
  gennaio: 1,
  gen: 1,
  january: 1,
  jan: 1,
  febbraio: 2,
  feb: 2,
  february: 2,
  marzo: 3,
  mar: 3,
  march: 3,
  aprile: 4,
  apr: 4,
  april: 4,
  maggio: 5,
  mag: 5,
  may: 5,
  giugno: 6,
  giu: 6,
  june: 6,
  jun: 6,
  luglio: 7,
  lug: 7,
  july: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  august: 8,
  aug: 8,
  settembre: 9,
  set: 9,
  sett: 9,
  september: 9,
  sep: 9,
  sept: 9,
  ottobre: 10,
  ott: 10,
  october: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  november: 11,
  dicembre: 12,
  dic: 12,
  december: 12,
  dec: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const NUMERIC_DATE = /\b(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})\b/g;
const SHORT_DATE = /\b(\d{1,2})\/(\d{1,2})\b(?![/\d])/g;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NAMED_DATE = new RegExp(
  `\\b(\\d{1,2})(?:º|°)?\\s+(${MONTH_PATTERN})\\.?(?:\\s+(\\d{4}))?\\b`,
  'gi',
);

const TIME = /\b((?:[01]?\d|2[0-3])[:h][0-5]\d)\b/;
const DOTTED_TIME = /\b(?:ore|alle)\s+((?:[01]?\d|2[0-3])\.[0-5]\d)\b/i;

const TRAIN_NAMES = [
  'Frecciarossa',
  'Frecciargento',
  'Frecciabianca',
  'Intercity Notte',
  'Intercity',
  'Italo',
  'Regionale Veloce',
  'Regionale',
  'Eurocity',
  'Euronight',
  'Railjet Xpress',
  'Railjet',
  'Nightjet',
];
const NUMBER_PREFIX =
  '\\s*(?:n\\.?|nr\\.?|numero|№|#)?\\s*[:]?\\s*(\\d{1,5})\\b';
const TRAIN_NAME_NUMBER = new RegExp(
  `\\b(${TRAIN_NAMES.join('|')})${NUMBER_PREFIX}`,
  'i',
);
const TRAIN_CODE_NUMBER = new RegExp(
  `\\b(${Object.keys(TRAIN_CODES).join('|')})${NUMBER_PREFIX}`,
);
const PLAIN_TRAIN_NUMBER =
  /\b(?:treno|train)(?:\s+(?:n\.?|nr\.?|numero|number))?\s*[:#]?\s*(\d{1,5})\b/i;

const OPERATORS: [RegExp, string][] = [
  [/\btrenitalia\b/i, 'Trenitalia'],
  [/\bitalo\b|\bntv\b/i, 'Italo'],
  [/\btrenord\b/i, 'Trenord'],
  [/\bnightjet\b|\böbb\b|\bobb\b|\brailjet\b/i, 'ÖBB'],
  [/\bouigo\b/i, 'OUIGO'],
  [/\btgv\b/i, 'TGV INOUI'],
  [/\bsncf\b/i, 'SNCF Voyageurs'],
  [/\beurostar\b/i, 'Eurostar'],
  [/\brenfe\b/i, 'Renfe'],
  [/\bdeutsche bahn\b|\bdb fernverkehr\b/i, 'Deutsche Bahn'],
  [/\bsbb\b|\bcff\b|\bffs\b/i, 'SBB CFF FFS'],
  [
    /\bfrecciarossa\b|\bfrecciargento\b|\bfrecciabianca\b|\bintercity\b/i,
    'Trenitalia',
  ],
];

const CLASS_RULES: [RegExp, SeatClass][] = [
  [/\b(?:cuccetta|couchette|vagone letto|sleeper|wagon[- ]lit)\b/i, 'sleeper'],
  [/\bbusiness\b/i, 'business'],
  [
    /\b(?:club executive|executive|prima classe|1\s*[ªa°º]\s*classe|1st class|first(?: class)?)\b/i,
    'first',
  ],
  [/\b(?:premium|comfort)\b/i, 'premium'],
  [
    /\b(?:standard|smart|seconda classe|2\s*[ªa°º]\s*classe|2nd class|second(?: class)?|economy)\b/i,
    'second',
  ],
];
const CLASS_LABEL =
  /^(?:classe|class|servizio|livello(?: di servizio)?|service|offerta|tariffa|fare)\s*[:\-]?\s*(.+)$/i;

const NOISE_LINE =
  /\b(?:acquist\w*|emess\w*|emission\w*|purchase\w*|ordine|order|inviat\w*|sent|prenotat\w* il|booked on|importo|prezzo|totale|total)\b/i;

const FROM_LABEL =
  /^(?:(?:da|from)\s*[:\-]|(?:origine|partenza(?: da)?|stazione di partenza|departure(?: from)?)\s*[:\-]?)\s*(.*)$/i;
const TO_LABEL =
  /^(?:(?:a|to)\s*[:\-]|(?:destinazione|arrivo(?: a)?|stazione di arrivo|arrival(?: at)?)\s*[:\-]?)\s*(.*)$/i;
const ARROW_LINE =
  /^(.{3,60}?)\s*(?:→|->|=>|➔|➜|➝|»|>|\s[-–—]\s)\s*(.{3,70})$/u;
const INLINE_ROUTE =
  /\bda\s+([A-Za-zÀ-ÿ'.\s]{3,40}?)\s+a\s+([A-Za-zÀ-ÿ'.\s]{3,40}?)(?=\s+(?:ore|alle|il|del|in|\d)|[,.;]|$)/i;
const NOT_A_STATION =
  /^(?:treno|train|carrozza|vettura|coach|posto|seat|binario|platform|classe|class|pnr|codice|passeggero|andata|ritorno|partenza|arrivo|departure|arrival|ore|alle)\b/i;
const DEPARTURE_TIME =
  /\b(?:partenza|departure|dep\.?)[^\d\n]{0,40}?((?:[01]?\d|2[0-3])[:h][0-5]\d)\b/i;
const ARRIVAL_TIME =
  /\b(?:arrivo|arrival|arr\.?)[^\d\n]{0,40}?((?:[01]?\d|2[0-3])[:h][0-5]\d)\b/i;
const EVERY_TIME = new RegExp(`${TIME.source}|${DOTTED_TIME.source}`, 'gi');

const COACH =
  /\b(?:carrozza|carr\.?|vettura|coach|car|wagon)\s*[:#]?\s*(\d{1,2}[A-Z]?)\b/i;
const SEAT =
  /\b(?:posto|posti|seat|place|sedile)\s*[:#]?\s*(\d{1,3}\s?[A-Z]?)\b/i;
const PLATFORM =
  /\b(?:binario|bin\.?|platform)\s*[:#]?\s*(\d{1,2}[A-Z]?|[A-Z]{1,2}\d?)\b/i;
const BOOKING_LABEL =
  /\b(?:pnr|codice(?:\s+di)?\s+prenotazione|codice\s+biglietto|booking\s+(?:code|reference)|riferimento)\b[\s)\]]*[:#-]?\s*([A-Za-z0-9]+)/gi;
const PASSENGER =
  /^(?:passeggero|viaggiatore|intestatario|passenger|nome(?: e cognome)?)\s*[:-]\s*([A-Za-zÀ-ÿ' .-]{3,60})$/im;

const LEG_MARKER =
  /^(?:andata|ritorno|outbound|return|viaggio|tratta|leg|trip)\b/i;

type Leg = {
  trainNumber: string | null;
  trainName: string | null;
  operatorName: string | null;
  from: string | null;
  to: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  departurePlatform: string | null;
  coach: string | null;
  seat: string | null;
  seatClass: SeatClass | null;
  bookingCode: string | null;
  passengerName: string | null;
};

const emptyLeg = (): Leg => ({
  trainNumber: null,
  trainName: null,
  operatorName: null,
  from: null,
  to: null,
  departureDate: null,
  arrivalDate: null,
  departureTime: null,
  arrivalTime: null,
  departurePlatform: null,
  coach: null,
  seat: null,
  seatClass: null,
  bookingCode: null,
  passengerName: null,
});

const pad = (n: number) => String(n).padStart(2, '0');

const isRealDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/** A date without a year is the next occurrence, within the last two months. */
const inferYear = (month: number, day: number, now: Date) => {
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day).getTime();
  return candidate < now.getTime() - 60 * 24 * 60 * 60 * 1000 ? year + 1 : year;
};

const toIsoDate = (year: number, month: number, day: number) =>
  isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null;

export const findDates = (text: string, now: Date): string[] => {
  const found: { index: number; date: string }[] = [];

  const add = (index: number, date: string | null) => {
    if (date) found.push({ index, date });
  };

  for (const m of text.matchAll(ISO_DATE)) {
    add(m.index, toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const year = m[4]!.length === 2 ? 2000 + Number(m[4]) : Number(m[4]);
    add(m.index, toIsoDate(year, Number(m[3]), Number(m[1])));
  }
  for (const m of text.matchAll(SHORT_DATE)) {
    const month = Number(m[2]);
    add(
      m.index,
      toIsoDate(inferYear(month, Number(m[1]), now), month, Number(m[1])),
    );
  }
  for (const m of text.matchAll(NAMED_DATE)) {
    const month = MONTHS[m[2]!.toLowerCase()]!;
    const day = Number(m[1]);
    const year = m[3] ? Number(m[3]) : inferYear(month, day, now);
    add(m.index, toIsoDate(year, month, day));
  }

  // Overlapping patterns can read one date twice (e.g. 27/10/2026 as 27/10).
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .map((f) => f.date)
    .filter((date) => !seen.has(date) && !!seen.add(date));
};

const normalizeTime = (raw: string) => {
  const [hours, minutes] = raw.split(/[:h.]/);
  return `${pad(Number(hours))}:${minutes}`;
};

/** Takes the first time out of the text and returns it with the rest. */
const extractTime = (text: string) => {
  const dotted = text.match(DOTTED_TIME);
  const plain = text.match(TIME);
  const found = dotted ?? plain;
  if (!found) {
    return { time: null, rest: text };
  }

  const rest = text
    .replace(dotted ? DOTTED_TIME : TIME, ' ')
    .replace(/\b(?:ore|alle|at)\s*$/i, ' ')
    .replace(/\(\s*\)/g, ' ');
  return { time: normalizeTime(found[1]!), rest };
};

const cleanStationName = (raw: string) => {
  const name = raw
    .replace(/\b(?:binario|platform|carrozza|posto|treno|train)\b.*$/i, '')
    .replace(/^(?:stazione di|stazione|station)\s+/i, '')
    .replace(/^[\s:;,.\-–—()]+|[\s:;,.\-–—()]+$/g, '')
    .replace(/\s{2,}/g, ' ');

  const letters = name.match(/\p{L}/gu)?.length ?? 0;
  const looksLikeStation =
    letters >= 3 &&
    name.length <= 50 &&
    /^\p{Lu}/u.test(name) &&
    !/\d{3,}|\d[:h]\d{2}/.test(name) &&
    !NOT_A_STATION.test(name);
  return looksLikeStation ? name : null;
};

const splitStationAndTime = (raw: string) => {
  const { time, rest } = extractTime(raw);
  return { station: cleanStationName(rest), time };
};

const parseTrain = (text: string, leg: Leg) => {
  const byCode = text.match(TRAIN_CODE_NUMBER);
  if (byCode) {
    leg.trainNumber = `${byCode[1]} ${byCode[2]}`;
    leg.trainName = TRAIN_CODES[byCode[1]!]!;
    return;
  }

  const byName = text.match(TRAIN_NAME_NUMBER);
  if (byName) {
    const name = TRAIN_NAMES.find(
      (n) => n.toLowerCase() === byName[1]!.toLowerCase(),
    )!;
    const code = CODE_BY_TRAIN_NAME.get(name.toLowerCase());
    leg.trainName = name;
    leg.trainNumber = code ? `${code} ${byName[2]}` : byName[2]!;
    return;
  }

  const plain = text.match(PLAIN_TRAIN_NUMBER);
  if (plain) {
    leg.trainNumber = plain[1]!;
  }
};

const NOISE_PATTERNS = [
  TRAIN_NAME_NUMBER,
  TRAIN_CODE_NUMBER,
  PLAIN_TRAIN_NUMBER,
  ISO_DATE,
  NUMERIC_DATE,
  SHORT_DATE,
  NAMED_DATE,
  EVERY_TIME,
].map(
  (pattern) =>
    new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    ),
);

/** A line without its train number, dates and times: what is left is names. */
const stripTicketNoise = (line: string) =>
  NOISE_PATTERNS.reduce((text, pattern) => text.replace(pattern, ' '), line)
    .replace(/\b(?:ore|alle|il|del|treno|train)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const parseRoute = (lines: string[], leg: Leg) => {
  // 1. Labelled lines: "Da: Milano Centrale ore 10:00", or a label on its
  //    own line followed by the value on the next one.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isFrom = FROM_LABEL.exec(line);
    const isTo = isFrom ? null : TO_LABEL.exec(line);
    const match = isFrom ?? isTo;
    if (!match) {
      continue;
    }

    let value = match[1]!.trim();
    if (value === '' && lines[i + 1]) {
      value = lines[i + 1]!;
      i += 1;
    }

    const { station, time } = splitStationAndTime(value);
    if (isFrom) {
      leg.from ??= station;
      leg.departureTime ??= time;
    } else {
      leg.to ??= station;
      leg.arrivalTime ??= time;
    }
  }
  if (leg.from && leg.to) {
    return;
  }

  // 2. "Milano Centrale -> Roma Termini", each side optionally with a time.
  //    The train number and the dates of a one-line message are taken out
  //    when they get in the way of the stations.
  for (const line of lines) {
    for (const candidate of [line, stripTicketNoise(line)]) {
      const arrow = ARROW_LINE.exec(candidate);
      if (!arrow) {
        continue;
      }

      const from = splitStationAndTime(arrow[1]!);
      const to = splitStationAndTime(arrow[2]!);
      if (from.station && to.station) {
        leg.from ??= from.station;
        leg.to ??= to.station;
        leg.departureTime ??= from.time;
        leg.arrivalTime ??= to.time;
        return;
      }
    }
  }

  // 3. "10:00 Milano Centrale" then "12:55 Roma Termini".
  const timedStations = lines.flatMap((line) => {
    const { station, time } = splitStationAndTime(line);
    return station && time && !FROM_LABEL.test(line) && !TO_LABEL.test(line)
      ? [{ station, time }]
      : [];
  });
  if (timedStations.length >= 2) {
    leg.from ??= timedStations[0]!.station;
    leg.to ??= timedStations[1]!.station;
    leg.departureTime ??= timedStations[0]!.time;
    leg.arrivalTime ??= timedStations[1]!.time;
    return;
  }

  // 4. SMS style: "da Milano Centrale a Roma Termini il 27/10".
  for (const line of lines) {
    const inline = INLINE_ROUTE.exec(line);
    if (inline) {
      leg.from ??= cleanStationName(inline[1]!);
      leg.to ??= cleanStationName(inline[2]!);
      return;
    }
  }
};

const parseClass = (lines: string[]): SeatClass | null => {
  const labelled = lines
    .map((line) => CLASS_LABEL.exec(line)?.[1])
    .find((value) => value);
  const candidates = labelled ? [labelled] : lines;

  for (const text of candidates) {
    for (const [pattern, seatClass] of CLASS_RULES) {
      if (pattern.test(text)) {
        return seatClass;
      }
    }
  }
  return null;
};

const parseBookingCode = (text: string) => {
  for (const match of text.matchAll(BOOKING_LABEL)) {
    if (/^[A-Z0-9]{6,8}$/.test(match[1]!)) {
      return match[1]!;
    }
  }
  return null;
};

const parseOperator = (text: string) =>
  OPERATORS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

const parseBlock = (block: string, now: Date): Leg => {
  const leg = emptyLeg();
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const relevant = lines.filter((line) => !NOISE_LINE.test(line));
  const text = relevant.join('\n');

  parseTrain(text, leg);
  parseRoute(relevant, leg);

  const [firstDate, secondDate] = findDates(text, now);
  leg.departureDate = firstDate ?? null;
  leg.arrivalDate = secondDate ?? null;

  const labelledDeparture = text.match(DEPARTURE_TIME)?.[1];
  const labelledArrival = text.match(ARRIVAL_TIME)?.[1];
  leg.departureTime ??= labelledDeparture
    ? normalizeTime(labelledDeparture)
    : null;
  leg.arrivalTime ??= labelledArrival ? normalizeTime(labelledArrival) : null;

  if (!leg.departureTime || !leg.arrivalTime) {
    const times = [
      ...new Set(
        [...text.matchAll(EVERY_TIME)].map((m) => normalizeTime(m[1] ?? m[2]!)),
      ),
    ].filter((time) => time !== leg.departureTime && time !== leg.arrivalTime);
    leg.departureTime ??= times.shift() ?? null;
    leg.arrivalTime ??= times.shift() ?? null;
  }

  leg.coach = text.match(COACH)?.[1] ?? null;
  leg.seat = text.match(SEAT)?.[1]?.replace(/\s/g, '') ?? null;
  leg.departurePlatform = text.match(PLATFORM)?.[1] ?? null;
  leg.seatClass = parseClass(relevant);
  leg.bookingCode = parseBookingCode(text);
  leg.passengerName = text.match(PASSENGER)?.[1]?.trim() ?? null;
  leg.operatorName = parseOperator(text);

  return leg;
};

const trainNumberOf = (text: string) => {
  const leg = emptyLeg();
  parseTrain(text, leg);
  return leg.trainNumber;
};

const isRouteLine = (line: string) => {
  const arrow = ARROW_LINE.exec(line);
  return (
    !!arrow &&
    !!splitStationAndTime(arrow[1]!).station &&
    !!splitStationAndTime(arrow[2]!).station
  );
};

/**
 * Paragraphs are blocks, and so are legs of a message without blank lines
 * (typical of text taken from an HTML e-mail): a leg marker, a different
 * train number or a second route line starts a new block.
 */
const splitBlocks = (text: string) => {
  const blocks: string[] = [];
  let current: string[] = [];
  let currentHasRoute = false;
  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
    }
    current = [];
    currentHasRoute = false;
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      continue;
    }

    const lineTrain = trainNumberOf(trimmed);
    const currentTrain = current.length
      ? trainNumberOf(current.join('\n'))
      : null;
    const routeLine = isRouteLine(trimmed);
    if (
      current.length > 0 &&
      (LEG_MARKER.test(trimmed) ||
        (lineTrain && currentTrain && lineTrain !== currentTrain) ||
        (routeLine && currentHasRoute))
    ) {
      flush();
    }
    current.push(trimmed);
    currentHasRoute ||= routeLine;
  }
  flush();

  return blocks;
};

const fillMissing = (target: Leg, source: Leg) => {
  for (const key of Object.keys(target) as (keyof Leg)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (target as any)[key] ??= source[key];
  }
};

const addDay = (date: string) => {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
};

export const normalizeText = (text: string) =>
  text
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Reads the train legs out of the text of a ticket message, e-mail or pass.
 * Tickets with a route, or with a train number and a departure, are returned.
 */
export const parseTicketText = (
  text: string,
  options: { now?: Date; source?: TicketSource } = {},
): ParsedTicket[] => {
  const now = options.now ?? new Date();
  const source = options.source ?? 'text';

  const legs: Leg[] = [];
  const shared = emptyLeg();
  for (const block of splitBlocks(normalizeText(text))) {
    const leg = parseBlock(block, now);
    fillMissing(shared, {
      ...emptyLeg(),
      bookingCode: leg.bookingCode,
      passengerName: leg.passengerName,
      operatorName: leg.operatorName,
      seatClass: leg.seatClass,
      departureDate: leg.departureDate,
    });

    // A block without a route (a subject line, a booking code) belongs to the
    // leg that follows it, unless that leg is another train.
    const previous = legs.at(-1);
    const startsNewLeg =
      !previous ||
      (leg.from && leg.to && previous.from && previous.to) ||
      (leg.trainNumber &&
        previous.trainNumber &&
        leg.trainNumber !== previous.trainNumber);
    if (previous && !startsNewLeg) {
      fillMissing(previous, leg);
    } else {
      legs.push(leg);
    }
  }

  let lastDate: string | null = null;
  return legs
    .filter(
      (leg) => (leg.from && leg.to) || (leg.trainNumber && leg.departureTime),
    )
    .map((leg) => {
      const departureDate =
        leg.departureDate ?? lastDate ?? shared.departureDate;
      lastDate = departureDate ?? lastDate;

      const arrivalDate =
        leg.arrivalDate ??
        (departureDate && leg.arrivalTime && leg.departureTime
          ? leg.arrivalTime < leg.departureTime
            ? addDay(departureDate)
            : departureDate
          : departureDate);

      const ticket = emptyTicket(source);
      ticket.operatorName = leg.operatorName ?? shared.operatorName;
      ticket.trainNumber = leg.trainNumber;
      ticket.trainName = leg.trainName;
      ticket.from = leg.from;
      ticket.to = leg.to;
      ticket.departure = departureDate
        ? { date: departureDate, time: leg.departureTime }
        : null;
      ticket.arrival =
        arrivalDate && (leg.arrivalTime || leg.arrivalDate)
          ? { date: arrivalDate, time: leg.arrivalTime }
          : null;
      ticket.departurePlatform = leg.departurePlatform;
      ticket.coach = leg.coach;
      ticket.seat = leg.seat;
      ticket.seatClass = leg.seatClass ?? shared.seatClass;
      ticket.bookingCode = leg.bookingCode ?? shared.bookingCode;
      ticket.passengerName = leg.passengerName ?? shared.passengerName;
      return ticket;
    });
};
