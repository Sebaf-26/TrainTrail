import { describe, expect, it } from 'vitest';

import { parseTrenitaliaPages } from './trenitalia';
import { describeTrain } from './trains';

// Pages as the text reader gives them: lines, columns three spaces apart. The
// layout is that of real Trenitalia PDF tickets; names, codes and numbers are
// made up.
const SPACE = ' '.repeat(40);

const page = (...lines: string[]) => lines.join('\n');

/** A ticket with a change: one page per leg, the first without a PNR. */
const WITH_CHANGE = [
  page(
    `${SPACE}Pagina 1 di 1`,
    `${SPACE}CIV Carrier 0083 - Partita Iva: 00000000000`,
    `${SPACE}Data Emissione 20/10/2030 ore 10:00`,
    ' VIAGGIO da Torino Porta Nuova a Genova Piazza Principe il 28/10/2030 alle',
    ' ore 13:30   Codice Biglietto: 1111111111',
    ' Stazione di Partenza   Stazione di Arrivo',
    ' Torino Porta Nuova   Genova Piazza Principe   Treno: Regionale Veloce   2129',
    '   Servizio: 2° Classe',
    ' Ore 13:30 - 28/10/2030   Ore 15:30 - 28/10/2030',
    `${SPACE}* Importo pagato totale: 12.40 €`,
    'DETTAGLIO PASSEGGERI',
    'Nome Passeggero (Adulto)',
    'MARIO ROSSI',
    'CONDIZIONI DI TRASPORTO',
    'Valgono le condizioni di trasporto del vettore: www.trenitalia.com',
  ),
  page(
    `${SPACE}Pagina 1 di 1`,
    `${SPACE}Numero Titolo: 1111111110`,
    ' VIAGGIO da Genova Piazza Principe a Viareggio il 28/10/2030 alle ore 15:47   PNR: ABC12D',
    ' Stazione di Partenza   Stazione di Arrivo   Treno: Intercity   669',
    '   Servizio: 2° Classe',
    ' Genova Piazza Principe   Viareggio   Carrozza: 5',
    ' Ore 15:47 - 28/10/2030   Ore 18:06 - 28/10/2030',
    '   Posti: 1B',
    'CONDIZIONI DI TRASPORTO',
    'www.trenitalia.com',
  ),
];

describe('parseTrenitaliaPages', () => {
  it('reads one journey per VIAGGIO block, a trip with a change gives two', () => {
    const { tickets, warnings } = parseTrenitaliaPages(WITH_CHANGE);

    expect(warnings).toEqual([]);
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      source: 'pdf',
      operatorName: 'Trenitalia',
      from: 'Torino Porta Nuova',
      to: 'Genova Piazza Principe',
      departure: { date: '2030-10-28', time: '13:30' },
      arrival: { date: '2030-10-28', time: '15:30' },
      trainNumber: 'RV 2129',
      trainName: 'Regionale Veloce',
      seatClass: 'second',
      coach: null,
      seat: null,
    });
  });

  it('reads the coach and seat of a reserved leg, and its PNR', () => {
    const { tickets } = parseTrenitaliaPages(WITH_CHANGE);

    expect(tickets[1]).toMatchObject({
      from: 'Genova Piazza Principe',
      to: 'Viareggio',
      trainNumber: 'IC 669',
      coach: '5',
      seat: '1B',
      bookingCode: 'ABC12D',
    });
  });

  it('falls back on the ticket code when a leg has no PNR', () => {
    const { tickets } = parseTrenitaliaPages(WITH_CHANGE);

    expect(tickets[0]?.bookingCode).toBe('1111111111');
  });

  it('reads two journeys on the same page, with their classes', () => {
    const { tickets } = parseTrenitaliaPages([
      page(
        'Trenitalia',
        ' VIAGGIO da Torino Porta Nuova a Viareggio il 29/10/2030 alle ore 15:15   PNR: ZZZ99Z',
        ' Stazione di Partenza   Stazione di Arrivo   Treno: Frecciarossa   8623',
        '   Servizio: 1° Business',
        ' Torino Porta Nuova   Viareggio   Carrozza: 2',
        ' Ore 15:15 - 29/10/2030   Ore 18:50 - 29/10/2030',
        '   Posti: 14B',
        `${SPACE}Importo totale*: 40.90 €`,
        ' VIAGGIO da Viareggio a Torino Porta Nuova il 01/11/2030 alle ore 10:02   PNR: ZZZ99Z',
        ' Stazione di Partenza   Stazione di Arrivo   Treno: Frecciarossa   8606',
        '   Servizio: 1° Business',
        ' Viareggio   Torino Porta Nuova   Carrozza: 2',
        ' Ore 10:02 - 01/11/2030   Ore 13:40 - 01/11/2030',
        '   Posti: 3B',
        'CONDIZIONI DI TRASPORTO',
      ),
    ]);

    expect(
      tickets.map((ticket) => [ticket.trainNumber, ticket.seatClass]),
    ).toEqual([
      ['FR 8623', 'business'],
      ['FR 8606', 'business'],
    ]);
    expect(tickets[1]?.departure).toEqual({
      date: '2030-11-01',
      time: '10:02',
    });
  });

  it('reads a ticket whose heading has a date but no time, and no train number', () => {
    const { tickets } = parseTrenitaliaPages([
      page(
        'Trenitalia',
        ' VIAGGIO da Fiumicino Aeroporto a Roma Termini del 19/01/2030   Codice Biglietto: 2222222222',
        ' Stazione di Partenza   Stazione di Arrivo   Treno: Leonardo express',
        ' Fiumicino Aeroporto   Roma Termini   Servizio: 1ª CLASSE',
        ' Ore 07:53 - 19/01/2030   Ore 08:25 - 19/01/2030',
        'CONDIZIONI DI TRASPORTO',
      ),
    ]);

    expect(tickets[0]).toMatchObject({
      from: 'Fiumicino Aeroporto',
      to: 'Roma Termini',
      departure: { date: '2030-01-19', time: '07:53' },
      arrival: { date: '2030-01-19', time: '08:25' },
      trainName: 'Leonardo express',
      trainNumber: null,
      seatClass: 'first',
    });
  });

  it('reads a ticket for abroad, with Italian and English labels', () => {
    const { tickets } = parseTrenitaliaPages([
      page(
        'Trenitalia   CIV Carrier 1183 3216',
        `${SPACE}Titolo numero/Title number 3333333333`,
        `${SPACE}PNR: QWE12R`,
        'DETTAGLIO VIAGGIO/ITINERARY DETAILS',
        `${SPACE}Treno/Train:`,
        'Stazione di Partenza/From   Stazione di Arrivo/To   Frecciarossa 9292',
        `${SPACE}Servizio/Service: Standard`,
        'Torino Porta Susa   Paris-Gare-De-Lyon   Allegro',
        'Ore/Time 07:11 - 21/04/2030   Ore/Time 13:23 - 21/04/2030   Carrozza/Coach: 6',
        `${SPACE}Posti: 10D`,
        'DETTAGLIO PASSEGGERI/PASSENGERS DETAILS',
      ),
    ]);

    expect(tickets[0]).toMatchObject({
      from: 'Torino Porta Susa',
      to: 'Paris-Gare-De-Lyon',
      departure: { date: '2030-04-21', time: '07:11' },
      arrival: { date: '2030-04-21', time: '13:23' },
      trainNumber: 'FR 9292',
      seatClass: 'second',
      coach: '6',
      seat: '10D',
      bookingCode: 'QWE12R',
    });
  });

  it('counts a seat reservation bought afterwards as the same journey, once', () => {
    const ticket = page(
      'Trenitalia',
      ' VIAGGIO da Viareggio a Torino Porta Nuova il 31/01/2030 alle ore 10:12   PNR: BFK12K',
      ' Stazione di Partenza   Stazione di Arrivo   Treno: Frecciabianca   8606',
      '   Servizio: 2° Classe',
      ' Viareggio   Torino Porta Nuova   Carrozza: 6',
      ' Ore 10:12 - 31/01/2030   Ore 13:40 - 31/01/2030',
      '   Posti: 16C',
      'CONDIZIONI DI TRASPORTO',
    );
    const reservation = page(
      'Trenitalia',
      ' VIAGGIO da Viareggio a Torino Porta Nuova il 31/01/2030 alle ore 10:12   PNR: BFK12K',
      'Servizio Scelta Posto',
      'Treno   Data partenza   da   a   Punti   Prezzo',
      'FRECCIABIANCA 8606   31/01/2030   Viareggio   Torino Porta Nuova   2,00   2,00€',
      `${SPACE}Importo servizi*: 2.00 €`,
      'CONDIZIONI DI TRASPORTO',
    );

    const { tickets } = parseTrenitaliaPages([ticket, reservation]);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      coach: '6',
      seat: '16C',
      seatClass: 'second',
    });
  });

  it('gives Trenord regional trains to Trenord', () => {
    const { tickets } = parseTrenitaliaPages([
      page(
        'Trenitalia',
        ' VIAGGIO da Milano Centrale a Colico il 05/03/2030 alle ore 09:20   PNR: TRN12D',
        ' Stazione di Partenza   Stazione di Arrivo   Treno: Regionale Trenord   2345',
        '   Servizio: 2° Classe',
        ' Milano Centrale   Colico',
        ' Ore 09:20 - 05/03/2030   Ore 10:55 - 05/03/2030',
        'CONDIZIONI DI TRASPORTO',
      ),
    ]);

    expect(tickets[0]).toMatchObject({
      operatorName: 'Trenord',
      trainNumber: 'REG 2345',
    });
  });

  it('leaves PDFs of other operators alone, and says so when nothing is found', () => {
    expect(parseTrenitaliaPages(['FAHRSCHEIN + RESERVIERUNG'])).toEqual({
      tickets: [],
      warnings: [],
    });
    expect(
      parseTrenitaliaPages(['Trenitalia', ' VIAGGIO da Roma a Napoli'])
        .warnings,
    ).toEqual(['No Trenitalia ticket was found in this PDF.']);
  });
});

describe('parseTrenitaliaPages in English and for buses', () => {
  it('reads the English version of a ticket', () => {
    const { tickets } = parseTrenitaliaPages([
      page(
        `${SPACE}Page 1 of 1`,
        `${SPACE}Single Ticket - Issuer 1183`,
        `${SPACE}Entitlement Number: 4444444444`,
        ' TRAVEL from Viareggio To Torino Porta Nuova on 29/09/2030 at 10:12   PNR: VCC12D',
        ' Departure station   Arrival station   Train: FrecciaBianca   8606',
        '   Service: 2° Classe',
        ' Viareggio   Torino Porta Nuova   Coaches: 6',
        ' Hours 10:12 - 29/09/2030   Hours 13:40 - 29/09/2030',
        '   Seats: 3B',
        'PASSENGERS DETAILS',
        'For information go to www.trenitalia.com',
      ),
    ]);

    expect(tickets[0]).toMatchObject({
      from: 'Viareggio',
      to: 'Torino Porta Nuova',
      departure: { date: '2030-09-29', time: '10:12' },
      arrival: { date: '2030-09-29', time: '13:40' },
      trainNumber: 'FB 8606',
      seatClass: 'second',
      coach: '6',
      seat: '3B',
      bookingCode: 'VCC12D',
    });
  });

  it('does not take a leg run by bus for a train journey', () => {
    const result = parseTrenitaliaPages([
      page(
        'Trenitalia',
        ' VIAGGIO da Napoli Piazza Garibaldi a POMPEI SCAVI il 02/03/2030 alle ore 11:57   Codice Biglietto: 5555555555',
        " Servizio bus emesso per conto di un'azienda",
        ' Stazione di Partenza   Stazione di Arrivo   Bus: Autobus   NP17',
        '   Servizio: 2° Classe',
        ' Ore 11:57 - 02/03/2030   Ore 12:36 - 02/03/2030',
        'CONDIZIONI DI TRASPORTO',
      ),
    ]);

    expect(result.tickets).toEqual([]);
  });
});

describe('describeTrain', () => {
  it.each([
    ['Frecciarossa 8623', 'FR 8623', 'Frecciarossa'],
    ['FrecciaBianca 8606', 'FB 8606', 'FrecciaBianca'],
    ['Regionale Veloce 2129', 'RV 2129', 'Regionale Veloce'],
    ['InterCityNotte 35', 'ICN 35', 'InterCityNotte'],
    ['sfm 26454', 'SFM 26454', 'sfm'],
    ['Leonardo express', null, 'Leonardo express'],
    ['Allegro Express 12', '12', 'Allegro Express'],
  ])('reads "%s" as %s', (printed, number, name) => {
    expect(describeTrain(printed)).toEqual({ name, number });
  });
});
