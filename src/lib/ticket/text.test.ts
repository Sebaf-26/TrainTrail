import { describe, expect, it } from 'vitest';

import { stationNameVariants } from './stations';
import { findDates, parseTicketText } from './text';

// The samples below are modelled on the usual layout of train tickets and
// messages. They are not copies of real tickets: when a real one is not read
// correctly, add it here with the expected result.
const NOW = new Date(2026, 9, 20); // 20 October 2026

describe('findDates', () => {
  it('reads numeric, ISO and named dates in Italian and English', () => {
    expect(findDates('27/10/2026', NOW)).toEqual(['2026-10-27']);
    expect(findDates('27.10.26', NOW)).toEqual(['2026-10-27']);
    expect(findDates('2026-10-27', NOW)).toEqual(['2026-10-27']);
    expect(findDates('Lunedì 27 ottobre 2026', NOW)).toEqual(['2026-10-27']);
    expect(findDates('27 Oct 2026', NOW)).toEqual(['2026-10-27']);
  });

  it('puts a missing year in the next occurrence of the date', () => {
    expect(findDates('27/10', NOW)).toEqual(['2026-10-27']);
    expect(findDates('3 gennaio', NOW)).toEqual(['2027-01-03']);
  });

  it('ignores impossible dates and keeps each date once', () => {
    expect(findDates('31/02/2026', NOW)).toEqual([]);
    expect(findDates('12/13', NOW)).toEqual([]);
    expect(findDates('27/10/2026 e ancora 27/10/2026', NOW)).toEqual([
      '2026-10-27',
    ]);
  });
});

describe('parseTicketText', () => {
  it('reads a labelled e-mail style ticket', () => {
    const [ticket, ...others] = parseTicketText(
      `Il tuo viaggio
Andata
Frecciarossa 9605
Da: Milano Centrale
A: Roma Termini
Partenza: 27/10/2026 ore 10:00
Arrivo: 27/10/2026 ore 12:55
Carrozza 6 Posto 12A
Classe: Standard
Codice prenotazione (PNR): ABC123
Acquistato il 20/10/2026 alle 15:32`,
      { now: NOW },
    );

    expect(others).toEqual([]);
    expect(ticket).toMatchObject({
      source: 'text',
      operatorName: 'Trenitalia',
      trainNumber: 'FR 9605',
      trainName: 'Frecciarossa',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
      arrival: { date: '2026-10-27', time: '12:55' },
      coach: '6',
      seat: '12A',
      seatClass: 'second',
      bookingCode: 'ABC123',
    });
  });

  it('reads a one-line message', () => {
    const [ticket] = parseTicketText(
      'Trenitalia: FR 9605 da Milano Centrale a Roma Termini il 27/10 ore 10:00. Carrozza 6 posto 12A. PNR ABC123',
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      operatorName: 'Trenitalia',
      trainNumber: 'FR 9605',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
      coach: '6',
      seat: '12A',
      bookingCode: 'ABC123',
    });
  });

  it('reads a route written on the same line as the train and the date', () => {
    const [ticket] = parseTicketText(
      'FR 9605 MILANO C.LE -> FIRENZE S.M.N. 27/10/2026 10:00 11:50',
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      trainNumber: 'FR 9605',
      from: 'MILANO C.LE',
      to: 'FIRENZE S.M.N',
      departure: { date: '2026-10-27', time: '10:00' },
      arrival: { date: '2026-10-27', time: '11:50' },
    });
  });

  it('reads a route with the times on each side of an arrow', () => {
    const [ticket] = parseTicketText(
      `Frecciarossa 9610
Roma Termini 17:05 → Milano Centrale 19:55
Lunedì 27 ottobre 2026
Carrozza 3 Posto 7D
Premium`,
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      trainNumber: 'FR 9610',
      from: 'Roma Termini',
      to: 'Milano Centrale',
      departure: { date: '2026-10-27', time: '17:05' },
      arrival: { date: '2026-10-27', time: '19:55' },
      coach: '3',
      seat: '7D',
      seatClass: 'premium',
    });
  });

  it('reads times that precede each station', () => {
    const [ticket] = parseTicketText(
      `Italo 8905
27/10/2026
10:20 Torino Porta Nuova
12:55 Roma Termini`,
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      operatorName: 'Italo',
      trainName: 'Italo',
      from: 'Torino Porta Nuova',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:20' },
      arrival: { date: '2026-10-27', time: '12:55' },
    });
  });

  it('reads English labels and 12-hour free names', () => {
    const [ticket] = parseTicketText(
      `From: Zürich HB
To: Milano Centrale
Departure: 27 Oct 2026 14:02
Arrival: 27 Oct 2026 17:20
Train 307
Coach 11, Seat 45
Booking reference: XYZ789
Class: 1st class`,
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      trainNumber: '307',
      from: 'Zürich HB',
      to: 'Milano Centrale',
      departure: { date: '2026-10-27', time: '14:02' },
      arrival: { date: '2026-10-27', time: '17:20' },
      coach: '11',
      seat: '45',
      bookingCode: 'XYZ789',
      seatClass: 'first',
    });
  });

  it('reads outbound and return legs and shares the booking code', () => {
    const tickets = parseTicketText(
      `Codice prenotazione: ABC123
Passeggero: Mario Rossi

Andata
Frecciarossa 9605
Milano Centrale -> Roma Termini
27/10/2026 ore 10:00 - 12:55

Ritorno
Frecciarossa 9650
Roma Termini -> Milano Centrale
30/10/2026 ore 18:05 - 20:55`,
      { now: NOW },
    );

    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      trainNumber: 'FR 9605',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
      bookingCode: 'ABC123',
      passengerName: 'Mario Rossi',
    });
    expect(tickets[1]).toMatchObject({
      trainNumber: 'FR 9650',
      from: 'Roma Termini',
      to: 'Milano Centrale',
      departure: { date: '2026-10-30', time: '18:05' },
      arrival: { date: '2026-10-30', time: '20:55' },
      bookingCode: 'ABC123',
      passengerName: 'Mario Rossi',
    });
  });

  it('splits two legs written without blank lines', () => {
    const tickets = parseTicketText(
      `Frecciarossa 9605
Milano Centrale → Roma Termini
27/10/2026 10:00 12:55
Frecciarossa 9650
Roma Termini → Milano Centrale
30/10/2026 18:05 20:55`,
      { now: NOW },
    );

    expect(tickets.map((t) => t.trainNumber)).toEqual(['FR 9605', 'FR 9650']);
    expect(tickets[1]!.departure).toEqual({
      date: '2026-10-30',
      time: '18:05',
    });
  });

  it('moves the arrival to the next day for an overnight train', () => {
    const [ticket] = parseTicketText(
      `Intercity Notte 1960
Da: Roma Termini
A: Siracusa
Partenza: 27/10/2026 22:30
Arrivo: 06:15`,
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      trainNumber: 'ICN 1960',
      departure: { date: '2026-10-27', time: '22:30' },
      arrival: { date: '2026-10-28', time: '06:15' },
    });
  });

  it('does not take purchase dates and times for the journey', () => {
    const [ticket] = parseTicketText(
      `Acquistato il 20/10/2026 alle 15:32
Totale 89,00 €
FR 9605 Milano Centrale -> Roma Termini
27/10/2026 10:00 12:55`,
      { now: NOW },
    );

    expect(ticket).toMatchObject({
      departure: { date: '2026-10-27', time: '10:00' },
      arrival: { date: '2026-10-27', time: '12:55' },
    });
  });

  it('does not invent a station from a sentence', () => {
    const tickets = parseTicketText(
      'Partenza prevista alle 10:00\nTreno FR 9605 del 27/10/2026',
      { now: NOW },
    );

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({ from: null, to: null });
    expect(tickets[0]!.departure).toEqual({
      date: '2026-10-27',
      time: '10:00',
    });
  });

  it('maps ticket classes', () => {
    const classOf = (value: string) =>
      parseTicketText(
        `FR 9605 Milano -> Roma 27/10/2026 10:00\nClasse: ${value}`,
        {
          now: NOW,
        },
      )[0]?.seatClass;

    expect(classOf('Standard')).toBe('second');
    expect(classOf('Smart')).toBe('second');
    expect(classOf('Premium')).toBe('premium');
    expect(classOf('Comfort')).toBe('premium');
    expect(classOf('Business')).toBe('business');
    expect(classOf('Executive')).toBe('first');
    expect(classOf('1ª classe')).toBe('first');
    expect(classOf('Cuccetta')).toBe('sleeper');
  });

  it('returns nothing for text that is not a ticket', () => {
    expect(
      parseTicketText('Ciao, ci vediamo domani a pranzo!', { now: NOW }),
    ).toEqual([]);
    expect(parseTicketText('', { now: NOW })).toEqual([]);
  });
});

describe('stationNameVariants', () => {
  it('expands the abbreviations used by Trenitalia', () => {
    expect(stationNameVariants('MILANO C.LE')).toContain('MILANO Centrale');
    expect(stationNameVariants('FIRENZE S.M.N.')).toContain(
      'FIRENZE Santa Maria Novella',
    );
    expect(stationNameVariants('VENEZIA S.LUCIA')).toContain(
      'VENEZIA Santa Lucia',
    );
    expect(stationNameVariants('GENOVA P.PRINCIPE')).toContain(
      'GENOVA Piazza Principe',
    );
  });

  it('keeps the printed name and drops a qualifier in brackets', () => {
    expect(stationNameVariants('Venezia Mestre (Viale Stazione)')).toEqual([
      'Venezia Mestre (Viale Stazione)',
      'Venezia Mestre',
    ]);
    expect(stationNameVariants('Roma Termini')).toEqual(['Roma Termini']);
  });
});
