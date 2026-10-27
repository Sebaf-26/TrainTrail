import PostalMime, { type Attachment } from 'postal-mime';

import { mergeTickets } from './merge';
import { isPkpass, parsePkpass } from './pkpass';
import { parseTicketText } from './text';
import type { ParsedTicket, ParseTicketResult } from './types';

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  agrave: 'à',
  egrave: 'è',
  eacute: 'é',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  Agrave: 'À',
  Egrave: 'È',
  Eacute: 'É',
  ccedil: 'ç',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  rarr: '→',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  euro: '€',
};

const decodeEntity = (match: string, entity: string) => {
  if (entity.startsWith('#')) {
    const code =
      entity[1]?.toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : match;
  }
  return ENTITIES[entity] ?? match;
};

/** The text of an HTML e-mail, with table rows and paragraphs as lines. */
export const htmlToText = (html: string) =>
  html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table|section)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const attachmentBytes = (attachment: Attachment) => {
  const { content } = attachment;
  if (typeof content === 'string') {
    return attachment.encoding === 'base64'
      ? Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(content);
  }
  return new Uint8Array(content);
};

const isPassAttachment = (attachment: Attachment) =>
  attachment.mimeType === 'application/vnd.apple.pkpass' ||
  attachment.filename?.toLowerCase().endsWith('.pkpass') === true;

/** Reads the tickets in an e-mail: attached passes first, then the message text. */
export const parseEml = async (
  raw: string | Uint8Array,
  options: { now?: Date } = {},
): Promise<ParseTicketResult> => {
  const email = await PostalMime.parse(raw);

  // Relative dates such as "27 ottobre" are read against when it was sent.
  const sent = email.date ? new Date(email.date) : null;
  const now = sent && !Number.isNaN(sent.getTime()) ? sent : options.now;

  const warnings: string[] = [];
  const fromPasses: ParsedTicket[] = [];
  for (const attachment of email.attachments.filter(isPassAttachment)) {
    const bytes = attachmentBytes(attachment);
    if (!isPkpass(bytes)) {
      continue;
    }
    const result = parsePkpass(bytes, { now });
    fromPasses.push(...result.tickets);
    warnings.push(...result.warnings);
  }

  const body = email.text?.trim() ? email.text : htmlToText(email.html ?? '');
  const subject = email.subject ? `${email.subject}\n\n` : '';
  const fromText = parseTicketText(`${subject}${body}`, {
    source: 'email',
    now,
  });

  const tickets = mergeTickets(fromPasses, fromText);
  if (tickets.length === 0) {
    warnings.push('No train journey was found in this e-mail.');
  }
  return { tickets, warnings: tickets.length === 0 ? warnings : [] };
};
