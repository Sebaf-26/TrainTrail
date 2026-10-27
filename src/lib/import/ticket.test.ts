import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processTicketText } from './ticket';

const { stationQuery, getOperatorByName } = vi.hoisted(() => ({
  stationQuery: vi.fn(),
  getOperatorByName: vi.fn(),
}));

vi.mock('$app/state', () => ({
  page: { data: { user: { id: 'local-user' } } },
}));

vi.mock('$lib/trpc', () => ({
  api: { autocomplete: { station: { query: stationQuery } } },
}));

vi.mock('$lib/utils/data/operators', () => ({ getOperatorByName }));

const station = (id: number, name: string, tz = 'Europe/Rome') => ({
  id,
  code: String(id),
  name,
  tz,
});
const STATIONS = [
  station(1, 'Milano Centrale'),
  station(2, 'Roma Termini'),
  station(3, 'Firenze Santa Maria Novella'),
  station(4, 'Roma Tiburtina'),
];

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const options = { filterOwner: false, importMode: 'personal' as const };

const TICKET = `FR 9605
Da: Milano Centrale
A: Roma Termini
Partenza: 27/10/2026 10:00
Arrivo: 27/10/2026 12:55
Carrozza 6 Posto 12A
Classe: Standard
Codice prenotazione: ABC123
Trenitalia`;

beforeEach(() => {
  stationQuery.mockReset();
  stationQuery.mockImplementation(async (query: string) =>
    STATIONS.filter((s) => normalize(s.name).includes(normalize(query))),
  );
  getOperatorByName.mockReset();
  getOperatorByName.mockImplementation(async (name: string) =>
    name === 'Trenitalia' ? { id: 7, name, code: null } : null,
  );
});

describe('processTicketText', () => {
  it('builds a journey with local times converted to UTC', async () => {
    const result = await processTicketText(TICKET, options);

    expect(result.unknowns).toEqual({ stations: {}, operators: {}, train: {} });
    expect(result.exportedUsers).toEqual([]);
    expect(result.journeys).toHaveLength(1);
    expect(result.journeys[0]).toMatchObject({
      date: '2026-10-27',
      datePrecision: 'day',
      // CET (UTC+1) after the clocks changed on 25 October
      departure: '2026-10-27T09:00:00.000Z',
      arrival: '2026-10-27T11:55:00.000Z',
      departureScheduled: '2026-10-27T09:00:00.000Z',
      duration: 10500,
      trainNumber: 'FR 9605',
      note: 'Booking code ABC123',
      from: { id: 1, name: 'Milano Centrale' },
      to: { id: 2, name: 'Roma Termini' },
      operator: { id: 7, name: 'Trenitalia' },
      passengers: [
        {
          userId: 'local-user',
          coach: '6',
          seatNumber: '12A',
          seatClass: 'second',
        },
      ],
    });
  });

  it('matches a station written with the usual abbreviations', async () => {
    const result = await processTicketText(
      'FR 9605 MILANO C.LE -> FIRENZE S.M.N. 27/10/2026 10:00 11:50',
      options,
    );

    expect(result.journeys[0]).toMatchObject({
      from: { name: 'Milano Centrale' },
      to: { name: 'Firenze Santa Maria Novella' },
    });
    expect(result.unknowns.stations).toEqual({});
  });

  it('does not guess between several stations with a similar name', async () => {
    const result = await processTicketText(
      'FR 9605 Milano Centrale -> Roma 27/10/2026 10:00',
      options,
    );

    expect(result.journeys[0]!.to).toBeNull();
    expect(result.unknowns.stations).toEqual({ Roma: [0] });
  });

  it('uses the stations the user matched by hand', async () => {
    const result = await processTicketText(
      'FR 9605 Milano Centrale -> Roma 27/10/2026 10:00',
      { ...options, stationMapping: { Roma: STATIONS[3] as never } },
    );

    expect(result.journeys[0]!.to).toMatchObject({ name: 'Roma Tiburtina' });
    expect(result.unknowns.stations).toEqual({});
  });

  it('reports operators that are not known', async () => {
    const result = await processTicketText(
      'Italo 8905 Milano Centrale -> Roma Termini 27/10/2026 10:00',
      options,
    );

    expect(result.journeys[0]!.operator).toBeNull();
    expect(result.unknowns.operators).toEqual({ Italo: [0] });
  });

  it('reads the times in the timezone of each station', async () => {
    stationQuery.mockImplementation(async (query: string) =>
      [
        station(10, 'Zürich HB', 'Europe/Zurich'),
        station(11, 'London St Pancras', 'Europe/London'),
      ].filter((s) => normalize(s.name).includes(normalize(query))),
    );
    const result = await processTicketText(
      'Da: Zürich HB\nA: London St Pancras\nPartenza: 27/10/2026 08:00\nArrivo: 27/10/2026 15:00',
      options,
    );

    expect(result.journeys[0]).toMatchObject({
      departure: '2026-10-27T07:00:00.000Z',
      arrival: '2026-10-27T15:00:00.000Z',
      duration: 8 * 3600,
    });
  });

  it('skips tickets without a day and says so when nothing is left', async () => {
    await expect(
      processTicketText(
        'Treno FR 9605 Milano Centrale -> Roma Termini',
        options,
      ),
    ).rejects.toThrow('does not say which day');
  });

  it('explains when no journey is found', async () => {
    await expect(
      processTicketText('Ci vediamo a pranzo', options),
    ).rejects.toThrow('No train journey was found');
  });
});
