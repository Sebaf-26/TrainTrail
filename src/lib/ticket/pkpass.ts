import { strFromU8, unzipSync } from 'fflate';

import { parseTicketText } from './text';
import {
  emptyTicket,
  type ParsedTicket,
  type ParseTicketResult,
} from './types';

const MAX_PASS_BYTES = 5_000_000;
const MAX_ENTRY_BYTES = 2_000_000;

type PassField = {
  key?: string;
  label?: unknown;
  value?: unknown;
};

type PassStructure = Partial<
  Record<
    | 'headerFields'
    | 'primaryFields'
    | 'secondaryFields'
    | 'auxiliaryFields'
    | 'backFields',
    PassField[]
  >
>;

type PassJson = {
  organizationName?: unknown;
  description?: unknown;
  relevantDate?: unknown;
  semantics?: Record<string, unknown>;
  boardingPass?: PassStructure;
  eventTicket?: PassStructure;
  generic?: PassStructure;
  coupon?: PassStructure;
  storeCard?: PassStructure;
};

const FIELD_GROUPS = [
  'headerFields',
  'primaryFields',
  'secondaryFields',
  'auxiliaryFields',
  'backFields',
] as const;

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export const isPkpass = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

const decodeStrings = (bytes: Uint8Array) => {
  const utf16le = bytes[0] === 0xff && bytes[1] === 0xfe;
  const utf16be = bytes[0] === 0xfe && bytes[1] === 0xff;
  return new TextDecoder(
    utf16le ? 'utf-16le' : utf16be ? 'utf-16be' : 'utf-8',
  ).decode(bytes);
};

const unescape = (value: string) =>
  value.replace(/\\(["\\nt])/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c,
  );

/** pass.strings: `"KEY" = "value";` */
const parseStrings = (text: string) => {
  const strings = new Map<string, string>();
  for (const m of text.matchAll(
    /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g,
  )) {
    strings.set(unescape(m[1]!), unescape(m[2]!));
  }
  return strings;
};

const pickStrings = (files: Record<string, Uint8Array>) => {
  const names = Object.keys(files).filter((name) =>
    name.endsWith('.lproj/pass.strings'),
  );
  const preferred =
    ['it.lproj', 'en.lproj'].flatMap((dir) =>
      names.filter((name) => name.startsWith(dir)),
    )[0] ?? names[0];
  return preferred
    ? parseStrings(decodeStrings(files[preferred]!))
    : new Map<string, string>();
};

/** Dates in a pass are ISO 8601 with an offset; the ticket prints local time. */
const toLocalText = (value: string) => {
  const m = ISO_DATE_TIME.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : value;
};

const toDateTime = (value: unknown) => {
  const m = typeof value === 'string' ? ISO_DATE_TIME.exec(value) : null;
  return m
    ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` }
    : null;
};

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const semanticTicket = (
  semantics: Record<string, unknown> | undefined,
): ParsedTicket => {
  const ticket = emptyTicket('pkpass');
  if (!semantics) {
    return ticket;
  }

  const seat = Array.isArray(semantics.seats)
    ? (semantics.seats[0] as Record<string, unknown> | undefined)
    : undefined;
  const passenger = semantics.passengerName as
    { givenName?: string; familyName?: string } | undefined;

  ticket.from =
    asString(semantics.departureStationName) ??
    asString(semantics.departureLocationDescription);
  ticket.to =
    asString(semantics.destinationStationName) ??
    asString(semantics.destinationLocationDescription);
  ticket.departure = toDateTime(
    semantics.currentDepartureDate ?? semantics.originalDepartureDate,
  );
  ticket.arrival = toDateTime(
    semantics.currentArrivalDate ?? semantics.originalArrivalDate,
  );
  ticket.departurePlatform = asString(semantics.departurePlatform);
  ticket.trainNumber = asString(semantics.vehicleNumber);
  ticket.operatorName = asString(semantics.transitProvider);
  ticket.seat = asString(seat?.seatNumber);
  ticket.coach = asString(seat?.seatSection);
  ticket.passengerName = passenger
    ? asString(`${passenger.givenName ?? ''} ${passenger.familyName ?? ''}`)
    : null;
  return ticket;
};

const structureOf = (pass: PassJson): PassStructure =>
  pass.boardingPass ??
  pass.eventTicket ??
  pass.generic ??
  pass.coupon ??
  pass.storeCard ??
  {};

const localizer = (strings: Map<string, string>) => (value: unknown) => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return strings.get(text) ?? text;
};

const fieldText = (pass: PassJson, strings: Map<string, string>) => {
  const localize = localizer(strings);
  const structure = structureOf(pass);

  const lines = [
    localize(pass.organizationName),
    localize(pass.description),
    ...FIELD_GROUPS.flatMap((group) => structure[group] ?? []).map((field) => {
      const label = localize(field.label);
      const value = toLocalText(localize(field.value));
      return label ? `${label}: ${value}` : value;
    }),
  ];
  return lines.filter(Boolean).join('\n');
};

const STATION_LABEL_KEY =
  /^(?:(?:departure|arrival|origin|destination)[_ ]?(?:location|station)|from|to)$/i;
const COACH_SEAT_LABEL =
  /(?:carr|vettura|coach|wagon|car)\b.*(?:posto|seat|place)/i;
const COACH_SEAT_VALUE = /^\s*(\w{1,3})\s*[-/]\s*(\w{1,4})\s*$/;

/**
 * What the structure of the pass says outright. The two date-times in the
 * primary fields are the times printed on the ticket: Trenitalia marks them
 * `ignoresTimeZone`, so their `Z` is not real, unlike the header date, which
 * is the departure in UTC and would read an hour early. Station names can be
 * the labels of those fields, and "Carr. - Posto" holds coach and seat.
 */
const structuredTicket = (
  pass: PassJson,
  strings: Map<string, string>,
): ParsedTicket => {
  const ticket = emptyTicket('pkpass');
  const localize = localizer(strings);
  const structure = structureOf(pass);

  const timed = (structure.primaryFields ?? []).filter(
    (field) =>
      typeof field.value === 'string' && ISO_DATE_TIME.test(field.value),
  );
  if (timed.length === 2) {
    const [first, second] = timed as [PassField, PassField];
    const [departure, arrival] = /arriv/i.test(first.key ?? '')
      ? [second, first]
      : [first, second];
    const stationOf = (field: PassField) => {
      const label = typeof field.label === 'string' ? field.label : '';
      return STATION_LABEL_KEY.test(label) && strings.has(label)
        ? localize(label)
        : null;
    };
    ticket.departure = toDateTime(departure.value);
    ticket.arrival = toDateTime(arrival.value);
    ticket.from = stationOf(departure);
    ticket.to = stationOf(arrival);
  }

  for (const field of FIELD_GROUPS.flatMap((group) => structure[group] ?? [])) {
    const match = COACH_SEAT_LABEL.test(localize(field.label))
      ? COACH_SEAT_VALUE.exec(String(field.value ?? ''))
      : null;
    if (match) {
      ticket.coach = match[1]!;
      ticket.seat = match[2]!;
    }
  }
  return ticket;
};

const overlay = (base: ParsedTicket, extra: ParsedTicket): ParsedTicket => {
  const merged = { ...base };
  for (const key of Object.keys(extra) as (keyof ParsedTicket)[]) {
    if (extra[key] !== null && key !== 'source') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = extra[key];
    }
  }
  return merged;
};

/** Reads an Apple Wallet pass (.pkpass, a zip archive with a pass.json). */
export const parsePkpass = (
  bytes: Uint8Array,
  options: { now?: Date } = {},
): ParseTicketResult => {
  if (bytes.length > MAX_PASS_BYTES) {
    return { tickets: [], warnings: ['The pass file is too large.'] };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) =>
        file.originalSize <= MAX_ENTRY_BYTES &&
        (file.name === 'pass.json' ||
          file.name.endsWith('.lproj/pass.strings')),
    });
  } catch {
    return { tickets: [], warnings: ['The file is not a valid pass.'] };
  }

  const passBytes = files['pass.json'];
  if (!passBytes) {
    return { tickets: [], warnings: ['The pass has no pass.json.'] };
  }

  let pass: PassJson;
  try {
    pass = JSON.parse(strFromU8(passBytes)) as PassJson;
  } catch {
    return { tickets: [], warnings: ['The pass data is not valid JSON.'] };
  }

  const relevantDate =
    typeof pass.relevantDate === 'string' ? new Date(pass.relevantDate) : null;
  const now =
    relevantDate && !Number.isNaN(relevantDate.getTime())
      ? relevantDate
      : options.now;

  const strings = pickStrings(files);
  const fromText = parseTicketText(fieldText(pass, strings), {
    source: 'pkpass',
    now,
  });
  const semantic = semanticTicket(pass.semantics);
  const base = fromText[0] ?? emptyTicket('pkpass');
  const ticket = overlay(
    overlay(base, structuredTicket(pass, strings)),
    semantic,
  );

  const found =
    (ticket.from && ticket.to) || (ticket.trainNumber && ticket.departure);
  if (!found) {
    return {
      tickets: [],
      warnings: ['No train journey was found in this pass.'],
    };
  }

  return { tickets: [ticket, ...fromText.slice(1)], warnings: [] };
};
