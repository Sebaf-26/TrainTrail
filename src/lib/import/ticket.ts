import { page } from '$app/state';
import type { CreateJourney, Operator, Station } from '$lib/db/types';
import type {
  PlatformOptions,
  ProcessResult,
  UnknownImportValues,
} from '$lib/import/model';
import {
  parseTicketInput,
  stationNameVariants,
  type LocalDateTime,
  type ParsedTicket,
  type TicketInput,
} from '$lib/ticket';
import { api } from '$lib/trpc';
import { getOperatorByName } from '$lib/utils/data/operators';
import { parseLocalISO } from '$lib/utils/datetime/parse';

// Used until the station is known; the import is processed again once the
// user has matched the stations that were not recognised.
const FALLBACK_TIMEZONE = 'Europe/Rome';

const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const findStationByName = async (printed: string) => {
  for (const variant of stationNameVariants(printed)) {
    const results = await api.autocomplete.station.query(variant);
    const wanted = normalizeName(variant);

    const exact = results.find((s) => normalizeName(s.name) === wanted);
    if (exact) {
      return exact;
    }

    const longer = results.filter((s) =>
      normalizeName(s.name).startsWith(wanted),
    );
    if (longer.length === 1) {
      return longer[0]!;
    }
  }

  return null;
};

// Journeys store instants in UTC; a zoned date would print its own offset.
const toUtcIso = (local: LocalDateTime | null, timezone: string) =>
  local?.time
    ? new Date(
        parseLocalISO(`${local.date}T${local.time}`, timezone).getTime(),
      ).toISOString()
    : null;

const toJourney = (
  ticket: ParsedTicket & { departure: LocalDateTime },
  from: Station | null,
  to: Station | null,
  operator: Operator | null,
  userId: string,
): CreateJourney => {
  const departure = toUtcIso(ticket.departure, from?.tz ?? FALLBACK_TIMEZONE);
  const arrival = toUtcIso(
    ticket.arrival,
    to?.tz ?? from?.tz ?? FALLBACK_TIMEZONE,
  );
  const seconds =
    departure && arrival
      ? Math.round((Date.parse(arrival) - Date.parse(departure)) / 1000)
      : null;

  return {
    date: ticket.departure.date,
    datePrecision: 'day',
    departure,
    arrival,
    departureScheduled: departure,
    arrivalScheduled: arrival,
    duration: seconds !== null && seconds > 0 ? seconds : null,
    departurePlatform: ticket.departurePlatform,
    arrivalPlatform: null,
    trainNumber: ticket.trainNumber,
    unitNumber: null,
    note: ticket.bookingCode ? `Booking code ${ticket.bookingCode}` : null,
    from,
    to,
    operator,
    train: null,
    passengers: [
      {
        userId,
        guestName: null,
        seat: null,
        coach: ticket.coach,
        seatNumber: ticket.seat,
        seatClass: ticket.seatClass,
        journeyReason: null,
      },
    ],
    track: null,
    ticket: ticket.barcode
      ? {
          barcodeFormat: ticket.barcode.format,
          barcodeData: ticket.barcode.data,
          passengerName: ticket.passengerName,
        }
      : null,
  };
};

const addUnknown = (
  records: UnknownImportValues,
  key: string,
  journeyIndex: number,
) => {
  (records[key] ??= []).push(journeyIndex);
};

/**
 * Turns a pasted ticket message, an e-mail, an Apple Wallet pass or a Google
 * Wallet link into journeys. Stations are matched by the name printed on the
 * ticket; the ones that are not recognised are left for the user to match.
 */
export const processTicketInput = async (
  input: TicketInput,
  options: PlatformOptions,
): Promise<ProcessResult> => {
  const { tickets, warnings } = await parseTicketInput(input);
  if (tickets.length === 0) {
    throw new Error(warnings[0] ?? 'No train journey was found.');
  }

  const user = page.data.user;
  if (!user) {
    throw new Error('Sign in to import a ticket.');
  }
  const userId = user.id;
  const stations = new Map<string, Promise<Station | null>>();
  const resolveStation = (printed: string | null) => {
    if (!printed) {
      return Promise.resolve(null);
    }
    const mapped = options.stationMapping?.[printed];
    if (mapped) {
      return Promise.resolve(mapped);
    }
    if (!stations.has(printed)) {
      stations.set(printed, findStationByName(printed));
    }
    return stations.get(printed)!;
  };

  const journeys: CreateJourney[] = [];
  const unknownStations: UnknownImportValues = {};
  const unknownOperators: UnknownImportValues = {};
  let skippedRows = 0;

  for (const ticket of tickets) {
    // A journey needs at least its day.
    if (!ticket.departure) {
      skippedRows += 1;
      continue;
    }

    const journeyIndex = journeys.length;
    const from = await resolveStation(ticket.from);
    const to = await resolveStation(ticket.to);
    const operator = ticket.operatorName
      ? (options.operatorMapping?.[ticket.operatorName] ??
        (await getOperatorByName(ticket.operatorName)))
      : null;

    if (ticket.from && !from) {
      addUnknown(unknownStations, ticket.from, journeyIndex);
    }
    if (ticket.to && !to) {
      addUnknown(unknownStations, ticket.to, journeyIndex);
    }
    if (ticket.operatorName && !operator) {
      addUnknown(unknownOperators, ticket.operatorName, journeyIndex);
    }

    journeys.push(
      toJourney(
        { ...ticket, departure: ticket.departure },
        from,
        to,
        operator,
        userId,
      ),
    );
  }

  if (journeys.length === 0) {
    throw new Error('The ticket does not say which day the journey is.');
  }

  return {
    journeys,
    unknowns: {
      stations: unknownStations,
      operators: unknownOperators,
      train: {},
    },
    exportedUsers: [],
    skippedRows,
  };
};

export const processTicketText = (text: string, options: PlatformOptions) =>
  processTicketInput({ text }, options);

export const processTicketFile = async (file: File, options: PlatformOptions) =>
  processTicketInput(
    {
      file: {
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
    },
    options,
  );
