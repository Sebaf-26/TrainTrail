import { describe, expect, it } from 'vitest';

import { parseOebbPages } from './oebb';
import { oebbNightjetPages } from './oebb.fixture';
import { layoutPageLines } from './pdf';

const pages = oebbNightjetPages.map((items) =>
  layoutPageLines(items).join('\n'),
);

describe('layoutPageLines', () => {
  it('puts the items of a row on one line and keeps the columns apart', () => {
    const lines = layoutPageLines(oebbNightjetPages[0]!);

    expect(lines).toContain(
      '10.08   21:48   FIRENZE C. MARTE   -> WIEN HBF   11.08   09:06   2',
    );
  });

  it('reads the rows from top to bottom', () => {
    const lines = layoutPageLines(oebbNightjetPages[0]!);

    expect(lines.findIndex((line) => line.startsWith('DATUM'))).toBeLessThan(
      lines.findIndex((line) => line.startsWith('10.08')),
    );
  });

  it('joins words that are close and separates distant ones', () => {
    expect(
      layoutPageLines([
        { text: 'Mini', x: 10, y: 100, width: 20 },
        { text: 'Cabin', x: 32, y: 100, width: 25 },
        { text: '63 64', x: 200, y: 98, width: 25 },
      ]),
    ).toEqual(['Mini Cabin   63 64']);
  });
});

// The layout of a real ÖBB Nightjet ticket (a return trip, one page per leg),
// with the name and the codes made up.
describe('parseOebbPages', () => {
  const { tickets, warnings } = parseOebbPages(pages);

  it('reads one ticket per page', () => {
    expect(warnings).toEqual([]);
    expect(tickets).toHaveLength(2);
    expect(tickets.map((ticket) => ticket.source)).toEqual(['pdf', 'pdf']);
  });

  it('reads the outward leg: stations, times and train', () => {
    expect(tickets[0]).toMatchObject({
      operatorName: 'ÖBB',
      from: 'FIRENZE C. MARTE',
      to: 'WIEN HBF',
      departure: { date: '2026-08-10', time: '21:48' },
      arrival: { date: '2026-08-11', time: '09:06' },
      trainNumber: 'NJ 40294',
      trainName: 'Nightjet',
      seatClass: 'second',
    });
  });

  it('reads the coach and the seats, with where they are', () => {
    expect(tickets[0]).toMatchObject({
      coach: '437',
      seat: '93',
      seatType: 'window',
      details: 'Grossraumwagen · Seats 93 (window), 94 (aisle)',
    });
  });

  it('reads the return leg, with berths instead of seats', () => {
    expect(tickets[1]).toMatchObject({
      from: 'WIEN HBF',
      to: 'FIRENZE C. MARTE',
      departure: { date: '2026-08-14', time: '20:05' },
      arrival: { date: '2026-08-15', time: '06:48' },
      trainNumber: 'NJ 40233',
      coach: '434',
      seat: '63',
      seatType: 'other',
      details: 'Mini Cabin · Seats 63, 64 (upper)',
    });
  });

  it('reads the booking number and the passenger', () => {
    expect(tickets[0]).toMatchObject({
      bookingCode: '5555 6666 7777 8888',
      passengerName: 'Rossi Mario',
    });
    expect(tickets[1]?.bookingCode).toBe('5555 6666 7777 8888');
  });

  it('has no barcode: the symbol of a PDF is not read', () => {
    expect(tickets.every((ticket) => ticket.barcode === null)).toBe(true);
  });
});

describe('parseOebbPages for other pages', () => {
  it('skips pages that are not tickets and says so when none is', () => {
    expect(
      parseOebbPages(['Allgemeine Beförderungsbedingungen\nwww.oebb.at']),
    ).toEqual({
      tickets: [],
      warnings: ['No ÖBB ticket was found in this PDF.'],
    });
  });

  it('takes the year from a date that rolls over to the next one', () => {
    const page = [
      'FAHRSCHEIN + RESERVIERUNG   Rossi Mario',
      'Gültig: 2026',
      'DATUM   ZEIT   VON   ->   NACH   DATUM   ZEIT   KLASSE',
      '31.12   22:10   WIEN HBF   ->   VENEZIA S. LUCIA   01.01   08:20   1',
    ].join('\n');

    expect(parseOebbPages([page]).tickets[0]).toMatchObject({
      departure: { date: '2026-12-31', time: '22:10' },
      arrival: { date: '2027-01-01', time: '08:20' },
      seatClass: 'first',
    });
  });
});
