import { beforeEach, describe, expect, it, vi } from 'vitest';

const { extractPdfPages } = vi.hoisted(() => ({ extractPdfPages: vi.fn() }));

import { parseTicketInput, stationNameVariants } from './index';
import { oebbNightjetPages } from './oebb.fixture';

import { layoutPageLines } from './pdf';

// `layoutPageLines` is the real one: only reading the file with pdf.js is faked.
vi.mock('./pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pdf')>()),
  extractPdfPages,
}));

const PDF_BYTES = new TextEncoder().encode('%PDF-1.4 ...');
const pdfFile = (name = 'ticket.pdf') => ({
  file: { name, type: 'application/pdf', bytes: PDF_BYTES },
});

beforeEach(() => {
  extractPdfPages.mockReset();
});

describe('parseTicketInput with a PDF', () => {
  it('reads an ÖBB ticket, one journey per page', async () => {
    extractPdfPages.mockResolvedValue(
      oebbNightjetPages.map((items) => layoutPageLines(items).join('\n')),
    );

    const { tickets, warnings } = await parseTicketInput(pdfFile());

    expect(warnings).toEqual([]);
    expect(tickets.map((ticket) => [ticket.from, ticket.to])).toEqual([
      ['FIRENZE C. MARTE', 'WIEN HBF'],
      ['WIEN HBF', 'FIRENZE C. MARTE'],
    ]);
  });

  it('recognises a PDF by its first bytes, whatever its name', async () => {
    extractPdfPages.mockResolvedValue([]);

    await parseTicketInput(pdfFile('ticket.bin'));

    expect(extractPdfPages).toHaveBeenCalledOnce();
  });

  it('reads the text of another operator like a pasted message', async () => {
    extractPdfPages.mockResolvedValue([
      'FR 9605\nDa: Milano Centrale\nA: Roma Termini\nPartenza: 27/10/2026 10:00\nArrivo: 27/10/2026 12:55',
    ]);

    const { tickets } = await parseTicketInput(pdfFile(), {
      now: new Date(2026, 9, 20),
    });

    expect(tickets[0]).toMatchObject({
      source: 'pdf',
      from: 'Milano Centrale',
      to: 'Roma Termini',
      departure: { date: '2026-10-27', time: '10:00' },
    });
  });

  it('says so when the PDF has no text, as a scan has none', async () => {
    extractPdfPages.mockResolvedValue(['', '  ']);

    const result = await parseTicketInput(pdfFile());

    expect(result.tickets).toEqual([]);
    expect(result.warnings[0]).toContain('no text');
  });

  it('says so when the file cannot be read as a PDF', async () => {
    extractPdfPages.mockRejectedValue(new Error('Invalid PDF structure'));

    const result = await parseTicketInput(pdfFile());

    expect(result).toEqual({
      tickets: [],
      warnings: ['The file is not a readable PDF.'],
    });
  });

  it('says so when no journey is found in the text', async () => {
    extractPdfPages.mockResolvedValue(['Fattura n. 12\nImporto 40,00 EUR']);

    const result = await parseTicketInput(pdfFile());

    expect(result.warnings).toEqual([
      'No train journey was found in this PDF.',
    ]);
  });
});

describe('stationNameVariants for ÖBB names', () => {
  it('expands the abbreviations ÖBB prints', () => {
    expect(stationNameVariants('FIRENZE C. MARTE')).toContain(
      'FIRENZE Campo di Marte',
    );
    expect(stationNameVariants('WIEN HBF')).toContain('WIEN Hbf');
    expect(stationNameVariants('Salzburg Hauptbahnhof')).toContain(
      'Salzburg Hbf',
    );
  });
});
