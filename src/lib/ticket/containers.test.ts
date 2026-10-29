import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { htmlToText, parseEml } from './eml';
import { parseGoogleWalletLink } from './google-wallet';
import { looksLikeEml, parseTicketInput } from './index';
import { parsePkpass } from './pkpass';

// Samples are modelled on the usual structure of these formats, not copies of
// real tickets (apart from the Trenitalia pass below, with its personal data
// replaced): add real ones here when a format is not read correctly.
const NOW = new Date(2026, 9, 20);

const pass = (overrides: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  organizationName: 'Trenitalia',
  description: 'Biglietto',
  relevantDate: '2026-10-27T10:00:00+01:00',
  boardingPass: {
    transitType: 'PKTransitTypeTrain',
    primaryFields: [
      { key: 'from', label: 'Da', value: 'Milano Centrale' },
      { key: 'to', label: 'A', value: 'Roma Termini' },
    ],
    secondaryFields: [
      { key: 'dep', label: 'Partenza', value: '2026-10-27T10:00:00+01:00' },
      { key: 'arr', label: 'Arrivo', value: '2026-10-27T12:55:00+01:00' },
    ],
    auxiliaryFields: [
      { key: 'train', label: 'Treno', value: 'Frecciarossa 9605' },
      { key: 'coach', label: 'Carrozza', value: '6' },
      { key: 'seat', label: 'Posto', value: '12A' },
    ],
    backFields: [{ key: 'pnr', label: 'Codice prenotazione', value: 'ABC123' }],
  },
  ...overrides,
});

const zip = (files: Record<string, Uint8Array>) => zipSync(files);
const pkpass = (data: unknown, extra: Record<string, Uint8Array> = {}) =>
  zip({ 'pass.json': strToU8(JSON.stringify(data)), ...extra });

const utf16le = (text: string) => {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set([0xff, 0xfe]);
  for (let i = 0; i < text.length; i++) {
    bytes[2 + i * 2] = text.charCodeAt(i) & 0xff;
    bytes[3 + i * 2] = text.charCodeAt(i) >> 8;
  }
  return bytes;
};

const base64 = (bytes: Uint8Array) =>
  (btoa(String.fromCharCode(...bytes)).match(/.{1,76}/g) ?? []).join('\r\n');

describe('parsePkpass', () => {
  it('reads the fields of a boarding pass', () => {
    const { tickets, warnings } = parsePkpass(pkpass(pass()), { now: NOW });

    expect(warnings).toEqual([]);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      source: 'pkpass',
      operatorName: 'Trenitalia',
      trainNumber: 'FR 9605',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
      arrival: { date: '2026-10-27', time: '12:55' },
      coach: '6',
      seat: '12A',
      bookingCode: 'ABC123',
    });
  });

  it('prefers the semantic tags when the pass has them', () => {
    const data = pass({
      semantics: {
        departureStationName: 'Milano Centrale',
        destinationStationName: 'Roma Termini',
        originalDepartureDate: '2026-10-27T10:05:00+01:00',
        departurePlatform: '7',
        vehicleNumber: '9605',
        transitProvider: 'Trenitalia',
        seats: [{ seatNumber: '12A', seatSection: '6' }],
        passengerName: { givenName: 'Mario', familyName: 'Rossi' },
      },
    });
    const [ticket] = parsePkpass(pkpass(data), { now: NOW }).tickets;

    expect(ticket).toMatchObject({
      trainNumber: '9605',
      departure: { date: '2026-10-27', time: '10:05' },
      departurePlatform: '7',
      coach: '6',
      seat: '12A',
      passengerName: 'Mario Rossi',
    });
  });

  it('translates labels through pass.strings, also when it is UTF-16', () => {
    const data = pass();
    const fields = data.boardingPass.primaryFields;
    fields[0] = { key: 'from', label: 'FROM_LABEL', value: 'FROM_VALUE' };
    fields[1] = { key: 'to', label: 'TO_LABEL', value: 'TO_VALUE' };

    const strings = [
      '"FROM_LABEL" = "Da";',
      '"TO_LABEL" = "A";',
      '"FROM_VALUE" = "Milano Centrale";',
      '"TO_VALUE" = "Roma Termini";',
    ].join('\n');
    const [ticket] = parsePkpass(
      pkpass(data, { 'it.lproj/pass.strings': utf16le(strings) }),
      { now: NOW },
    ).tickets;

    expect(ticket).toMatchObject({
      from: 'Milano Centrale',
      to: 'Roma Termini',
    });
  });

  // Structure of a real Trenitalia pass (ProntoTreno); name, booking codes and
  // serial are made up. The times in the primary fields are the printed ones
  // (`ignoresTimeZone`), while the header date is the departure in UTC.
  it('reads the times, stations and seat of a Trenitalia pass', () => {
    const data = {
      formatVersion: 1,
      organizationName: 'Trenitalia',
      description: 'pk_boarding_pass_train_description',
      relevantDate: '2026-10-29T14:15:00Z',
      boardingPass: {
        transitType: 'PKTransitTypeTrain',
        headerFields: [
          {
            key: 'date',
            label: 'pk_label_date',
            value: '2026-10-29T14:15:00Z',
            dateStyle: 'PKDateStyleShort',
            isRelative: true,
          },
        ],
        primaryFields: [
          {
            key: 'departure_time',
            label: 'departure_location',
            value: '2026-10-29T15:15:00Z',
            timeStyle: 'PKDateStyleShort',
            ignoresTimeZone: true,
          },
          {
            key: 'arrival_time',
            label: 'arrival_location',
            value: '2026-10-29T18:50:00Z',
            timeStyle: 'PKDateStyleShort',
            ignoresTimeZone: true,
          },
        ],
        secondaryFields: [
          { key: 'pnr', label: 'PNR', value: 'ABC12D' },
          { key: 'cp', label: 'pk_label_cp', value: '123456' },
          { key: 'seat', label: 'pk_label_wagon_seat', value: '2 - 14B' },
        ],
        auxiliaryFields: [
          {
            key: 'passenger',
            label: 'pk_label_passenger',
            value: 'ROSSI MARIO',
          },
          { key: 'transport', label: 'pk_label_train', value: 'FR 8623' },
        ],
      },
    };
    const strings = [
      '"pk_boarding_pass_train_description"="Biglietto treno da Torino Porta Nuova a Viareggio";',
      '"departure_location"="Torino Porta Nuova";',
      '"arrival_location"="Viareggio";',
      '"pk_label_date"="Data";',
      '"pk_label_cp"="CP";',
      '"pk_label_wagon_seat"="Carr. - Posto";',
      '"pk_label_passenger"="Passeggero";',
      '"pk_label_train"="Treno";',
    ].join('\n');

    const result = parsePkpass(
      pkpass(data, { 'it.lproj/pass.strings': strToU8(strings) }),
      { now: NOW },
    );

    expect(result.warnings).toEqual([]);
    expect(result.tickets[0]).toMatchObject({
      from: 'Torino Porta Nuova',
      to: 'Viareggio',
      departure: { date: '2026-10-29', time: '15:15' },
      arrival: { date: '2026-10-29', time: '18:50' },
      trainNumber: 'FR 8623',
      coach: '2',
      seat: '14B',
      bookingCode: 'ABC12D',
      passengerName: 'ROSSI MARIO',
    });
  });

  it('explains why a file is not read', () => {
    expect(parsePkpass(new Uint8Array([1, 2, 3, 4, 5]), { now: NOW })).toEqual({
      tickets: [],
      warnings: ['The file is not a valid pass.'],
    });
    expect(
      parsePkpass(zip({ 'readme.txt': strToU8('hi') }), { now: NOW }).warnings,
    ).toEqual(['The pass has no pass.json.']);
    expect(
      parsePkpass(pkpass({ organizationName: 'Cinema', generic: {} }), {
        now: NOW,
      }).warnings,
    ).toEqual(['No train journey was found in this pass.']);
  });
});

const email = (headers: string[], body: string) =>
  [
    'From: Trenitalia <noreply@trenitalia.example>',
    'To: me@example.com',
    'Date: Mon, 20 Oct 2026 09:00:00 +0200',
    'MIME-Version: 1.0',
    ...headers,
    '',
    body,
  ].join('\r\n');

describe('htmlToText', () => {
  it('keeps table rows as lines and decodes entities', () => {
    expect(
      htmlToText(
        '<style>p{}</style><table><tr><td>Partenza</td><td>Milano&nbsp;Centrale</td></tr><tr><td>Da&agrave;</td><td>&#36;</td></tr></table>',
      ),
    ).toBe('Partenza Milano Centrale\nDaà $');
  });
});

describe('parseEml', () => {
  it('reads a plain text e-mail, using the subject too', async () => {
    const raw = email(
      [
        'Subject: Il tuo biglietto Frecciarossa 9605',
        'Content-Type: text/plain; charset=utf-8',
      ],
      'Gentile cliente,\r\n\r\nDa: Milano Centrale\r\nA: Roma Termini\r\nPartenza: 27 ottobre ore 10:00\r\nCarrozza 6 Posto 12A\r\nCodice prenotazione: ABC123',
    );
    const { tickets } = await parseEml(raw);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      source: 'email',
      trainNumber: 'FR 9605',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      // The year comes from the date the e-mail was sent.
      departure: { date: '2026-10-27', time: '10:00' },
      coach: '6',
      bookingCode: 'ABC123',
    });
  });

  it('reads an HTML-only e-mail', async () => {
    const raw = email(
      ['Subject: Biglietto', 'Content-Type: text/html; charset=utf-8'],
      '<html><body><table><tr><td>Treno</td><td>Italo 8905</td></tr><tr><td>Da:</td><td>Torino Porta Nuova</td></tr><tr><td>A:</td><td>Roma Termini</td></tr><tr><td>Partenza:</td><td>27/10/2026 10:20</td></tr></table></body></html>',
    );
    const { tickets } = await parseEml(raw);

    expect(tickets[0]).toMatchObject({
      operatorName: 'Italo',
      from: 'Torino Porta Nuova',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:20' },
    });
  });

  it('merges an attached pass with the text of the e-mail', async () => {
    const attachment = base64(pkpass(pass()));
    const raw = [
      'From: Trenitalia <noreply@trenitalia.example>',
      'To: me@example.com',
      'Subject: Il tuo biglietto',
      'Date: Mon, 20 Oct 2026 09:00:00 +0200',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="B"',
      '',
      '--B',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Treno FR 9605 del 27/10/2026. Codice prenotazione: ABC123',
      '--B',
      'Content-Type: application/vnd.apple.pkpass; name="ticket.pkpass"',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename="ticket.pkpass"',
      '',
      attachment,
      '--B--',
      '',
    ].join('\r\n');
    const { tickets } = await parseEml(raw);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      source: 'pkpass',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      coach: '6',
    });
  });

  it('says so when the e-mail has no journey', async () => {
    const result = await parseEml(
      email(['Subject: Ciao', 'Content-Type: text/plain'], 'Pranzo domani?'),
    );
    expect(result.tickets).toEqual([]);
    expect(result.warnings).toEqual([
      'No train journey was found in this e-mail.',
    ]);
  });
});

const token = (payload: unknown) => {
  const encode = (value: unknown) =>
    btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
};

describe('parseGoogleWalletLink', () => {
  it('reads a transit pass that carries its details', () => {
    const jwt = token({
      iss: 'issuer@example.iam.gserviceaccount.com',
      aud: 'google',
      typ: 'savetowallet',
      payload: {
        transitObjects: [
          {
            id: 'issuer.ticket1',
            passengerNames: 'Mario Rossi',
            ticketLeg: {
              originName: {
                defaultValue: { language: 'it', value: 'Milano Centrale' },
              },
              destinationName: {
                defaultValue: { language: 'it', value: 'Roma Termini' },
              },
              departureDateTime: '2026-10-27T10:00:00',
              arrivalDateTime: '2026-10-27T12:55:00',
              platform: '7',
              transitOperatorName: { defaultValue: { value: 'Trenitalia' } },
              ticketSeat: { coach: '6', seat: '12A', fareClass: 'ECONOMY' },
            },
          },
        ],
      },
    });
    const { tickets, warnings } = parseGoogleWalletLink(
      `Aggiungi a Google Wallet: https://pay.google.com/gp/v/save/${jwt}`,
      { now: NOW },
    );

    expect(warnings).toEqual([]);
    expect(tickets[0]).toMatchObject({
      source: 'google-wallet',
      operatorName: 'Trenitalia',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
      arrival: { date: '2026-10-27', time: '12:55' },
      departurePlatform: '7',
      coach: '6',
      seat: '12A',
      seatClass: 'second',
      passengerName: 'Mario Rossi',
    });
  });

  it('explains when the link only references the pass', () => {
    const jwt = token({
      payload: { transitObjects: [{ id: 'issuer.ticket1' }] },
    });
    const { tickets, warnings } = parseGoogleWalletLink(
      `https://pay.google.com/gp/v/save/${jwt}`,
      { now: NOW },
    );

    expect(tickets).toEqual([]);
    expect(warnings[0]).toContain('only points to the pass');
  });

  it('reports a link that is not a valid token', () => {
    expect(
      parseGoogleWalletLink('https://pay.google.com/gp/v/save/a.b.c').warnings,
    ).toEqual(['The Google Wallet link could not be read.']);
  });
});

describe('parseTicketInput', () => {
  it('detects raw e-mail source in pasted text', async () => {
    const raw = email(
      ['Subject: Biglietto FR 9605', 'Content-Type: text/plain'],
      'Da: Milano Centrale\r\nA: Roma Termini\r\nPartenza: 27/10/2026 10:00',
    );
    expect(looksLikeEml(raw)).toBe(true);

    const { tickets } = await parseTicketInput({ text: raw }, { now: NOW });
    expect(tickets[0]).toMatchObject({
      source: 'email',
      from: 'Milano Centrale',
    });
  });

  it('reads pasted message text', async () => {
    const { tickets } = await parseTicketInput(
      { text: 'FR 9605 Milano Centrale -> Roma Termini 27/10/2026 10:00' },
      { now: NOW },
    );
    expect(tickets[0]).toMatchObject({
      source: 'text',
      trainNumber: 'FR 9605',
    });
  });

  it('reads an uploaded pass and e-mail file', async () => {
    const bytes = pkpass(pass());
    const fromPass = await parseTicketInput(
      { file: { name: 'ticket.pkpass', bytes } },
      { now: NOW },
    );
    expect(fromPass.tickets[0]).toMatchObject({ source: 'pkpass' });

    const mail = email(
      ['Subject: Biglietto', 'Content-Type: text/plain'],
      'FR 9605 Milano Centrale -> Roma Termini 27/10/2026 10:00',
    );
    const fromMail = await parseTicketInput(
      { file: { name: 'mail.eml', bytes: new TextEncoder().encode(mail) } },
      { now: NOW },
    );
    expect(fromMail.tickets[0]).toMatchObject({ source: 'email' });
  });

  it('asks for something to read when the input is empty', async () => {
    expect((await parseTicketInput({ text: '   ' })).warnings).toHaveLength(1);
    expect((await parseTicketInput({})).tickets).toEqual([]);
  });
});
