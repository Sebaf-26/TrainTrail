import { parseEml } from './eml';
import { hasGoogleWalletLink, parseGoogleWalletLink } from './google-wallet';
import { mergeTickets } from './merge';
import { isPkpass, parsePkpass } from './pkpass';
import { parseTicketText } from './text';
import type { ParseTicketResult } from './types';

export { stationNameVariants } from './stations';
export type {
  LocalDateTime,
  ParsedTicket,
  ParseTicketResult,
  SeatClass,
} from './types';

export type TicketInput = {
  /** Text pasted by the user: a message, an e-mail or a Google Wallet link */
  text?: string;
  /** An uploaded .pkpass, .eml or text file */
  file?: { name: string; type?: string; bytes: Uint8Array };
};

const EML_HEADERS =
  /^(?:from|to|date|subject|received|return-path|mime-version|message-id|delivered-to):/gim;

/** Raw e-mail source starts with header lines; a pasted message does not. */
export const looksLikeEml = (text: string) =>
  (text.slice(0, 3000).match(EML_HEADERS)?.length ?? 0) >= 3;

const isEmlFile = (name: string, type?: string) =>
  name.toLowerCase().endsWith('.eml') || type === 'message/rfc822';

const isPkpassFile = (name: string, type?: string) =>
  name.toLowerCase().endsWith('.pkpass') ||
  type === 'application/vnd.apple.pkpass';

const parseText = async (
  text: string,
  now: Date | undefined,
): Promise<ParseTicketResult> => {
  if (looksLikeEml(text)) {
    return parseEml(text, { now });
  }

  const fromText = parseTicketText(text, { now });
  if (!hasGoogleWalletLink(text)) {
    return {
      tickets: fromText,
      warnings: fromText.length === 0 ? ['No train journey was found.'] : [],
    };
  }

  const fromLink = parseGoogleWalletLink(text, { now });
  const tickets = mergeTickets(fromLink.tickets, fromText);
  return { tickets, warnings: tickets.length === 0 ? fromLink.warnings : [] };
};

/**
 * Reads the train journeys in a pasted message or an uploaded file and returns
 * them as neutral tickets, ready to be matched to stations and reviewed.
 */
export const parseTicketInput = async (
  input: TicketInput,
  options: { now?: Date } = {},
): Promise<ParseTicketResult> => {
  const { file, text } = input;

  if (file) {
    if (
      isPkpassFile(file.name, file.type) ||
      (isPkpass(file.bytes) && !isEmlFile(file.name, file.type))
    ) {
      return parsePkpass(file.bytes, options);
    }
    if (isEmlFile(file.name, file.type)) {
      return parseEml(file.bytes, options);
    }
    return parseText(new TextDecoder().decode(file.bytes), options.now);
  }

  if (text && text.trim() !== '') {
    return parseText(text, options.now);
  }

  return {
    tickets: [],
    warnings: ['Nothing to read: paste the ticket text or choose a file.'],
  };
};
