import { parseTicketText } from './text';
import {
  emptyTicket,
  type ParsedTicket,
  type ParseTicketResult,
} from './types';

const SAVE_LINK = /pay\.google\.com\/gp\/v\/save\/([\w-]+\.[\w-]+\.[\w-]+)/;

const OBJECT_KEYS = [
  'transitObjects',
  'eventTicketObjects',
  'genericObjects',
] as const;

type Localized = { defaultValue?: { value?: string } } | string | undefined;

type TicketLeg = {
  originName?: Localized;
  destinationName?: Localized;
  departureDateTime?: string;
  arrivalDateTime?: string;
  platform?: string;
  carriage?: string;
  transitOperatorName?: Localized;
  ticketSeat?: {
    coach?: string;
    seat?: string;
    fareClass?: string;
    customFareClass?: Localized;
  };
};

type WalletObject = {
  id?: string;
  header?: Localized;
  subheader?: Localized;
  cardTitle?: Localized;
  passengerNames?: string;
  ticketLeg?: TicketLeg;
  ticketLegs?: TicketLeg[];
  textModulesData?: { header?: string; body?: string }[];
};

const localized = (value: Localized) =>
  typeof value === 'string' ? value : (value?.defaultValue?.value ?? null);

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  );
};

const FARE_CLASSES: Record<string, ParsedTicket['seatClass']> = {
  ECONOMY: 'second',
  FIRST: 'first',
  BUSINESS: 'business',
};

const toDateTime = (value: string | undefined) => {
  const m = value ? /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value) : null;
  return m ? { date: m[1]!, time: m[2]! } : null;
};

const legTicket = (leg: TicketLeg, object: WalletObject): ParsedTicket => {
  const ticket = emptyTicket('google-wallet');
  ticket.from = localized(leg.originName);
  ticket.to = localized(leg.destinationName);
  ticket.departure = toDateTime(leg.departureDateTime);
  ticket.arrival = toDateTime(leg.arrivalDateTime);
  ticket.departurePlatform = leg.platform ?? null;
  ticket.coach = leg.ticketSeat?.coach ?? leg.carriage ?? null;
  ticket.seat = leg.ticketSeat?.seat ?? null;
  ticket.seatClass = leg.ticketSeat?.fareClass
    ? (FARE_CLASSES[leg.ticketSeat.fareClass] ?? null)
    : null;
  ticket.operatorName = localized(leg.transitOperatorName);
  ticket.passengerName = object.passengerNames ?? null;
  return ticket;
};

const objectText = (object: WalletObject) =>
  [
    localized(object.cardTitle),
    localized(object.header),
    localized(object.subheader),
    ...(object.textModulesData ?? []).map((m) =>
      [m.header, m.body].filter(Boolean).join(': '),
    ),
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Reads a "Save to Google Wallet" link. The link carries a signed token; when
 * the issuer put the whole pass in it (rather than just a reference to it) the
 * journey can be read from the token.
 */
export const parseGoogleWalletLink = (
  text: string,
  options: { now?: Date } = {},
): ParseTicketResult => {
  const token = SAVE_LINK.exec(text)?.[1];
  if (!token) {
    return { tickets: [], warnings: ['No Google Wallet link was found.'] };
  }

  let objects: WalletObject[];
  try {
    const claims = JSON.parse(decodeBase64Url(token.split('.')[1]!)) as {
      payload?: Record<string, WalletObject[] | undefined>;
    };
    objects = OBJECT_KEYS.flatMap((key) => claims.payload?.[key] ?? []);
  } catch {
    return {
      tickets: [],
      warnings: ['The Google Wallet link could not be read.'],
    };
  }

  const tickets = objects.flatMap((object) => {
    const legs = [object.ticketLeg, ...(object.ticketLegs ?? [])].filter(
      (leg): leg is TicketLeg => !!leg,
    );
    if (legs.length > 0) {
      return legs.map((leg) => legTicket(leg, object));
    }
    return parseTicketText(objectText(object), {
      source: 'google-wallet',
      now: options.now,
    });
  });

  const complete = tickets.filter(
    (t) => (t.from && t.to) || (t.trainNumber && t.departure),
  );
  if (complete.length === 0) {
    return {
      tickets: [],
      warnings: [
        'This Google Wallet link only points to the pass and does not contain its details. Open the pass in Google Wallet and paste its text instead.',
      ],
    };
  }
  return { tickets: complete, warnings: [] };
};

export const hasGoogleWalletLink = (text: string) => SAVE_LINK.test(text);
