export type SeatClass = 'second' | 'first' | 'business' | 'premium' | 'sleeper';

/** Local wall-clock time at the station, as printed on the ticket. */
export type LocalDateTime = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, null when the ticket only states the day */
  time: string | null;
};

export const BarcodeFormats = ['aztec', 'qr', 'pdf417', 'code128'] as const;
export type BarcodeFormat = (typeof BarcodeFormats)[number];

/**
 * The barcode of a ticket, kept exactly as issued: it is shown again as the
 * same symbol, because the scanner that checks the ticket expects that format.
 */
export type TicketBarcode = {
  format: BarcodeFormat;
  /** Base64 of the raw bytes of the barcode message. */
  data: string;
};

export type TicketSource = 'text' | 'email' | 'pkpass' | 'google-wallet';

/**
 * One train leg read from a ticket. Every field is optional on the ticket, so
 * everything the reader could not find stays null and is completed by the user
 * in the import review step.
 */
export type ParsedTicket = {
  source: TicketSource;
  operatorName: string | null;
  /** The number as printed, e.g. "FR 9605" */
  trainNumber: string | null;
  /** The train category, e.g. "Frecciarossa" */
  trainName: string | null;
  /** Station names as printed on the ticket */
  from: string | null;
  to: string | null;
  departure: LocalDateTime | null;
  arrival: LocalDateTime | null;
  departurePlatform: string | null;
  coach: string | null;
  seat: string | null;
  seatClass: SeatClass | null;
  bookingCode: string | null;
  passengerName: string | null;
  barcode: TicketBarcode | null;
};

export type ParseTicketResult = {
  tickets: ParsedTicket[];
  /** Human readable reasons why nothing (or less than expected) was found */
  warnings: string[];
};

export const emptyTicket = (source: TicketSource): ParsedTicket => ({
  source,
  operatorName: null,
  trainNumber: null,
  trainName: null,
  from: null,
  to: null,
  departure: null,
  arrival: null,
  departurePlatform: null,
  coach: null,
  seat: null,
  seatClass: null,
  bookingCode: null,
  passengerName: null,
  barcode: null,
});
