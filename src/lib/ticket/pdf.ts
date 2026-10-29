/** A piece of text on a PDF page, with the position of its start (PDF points). */
export type PdfTextItem = {
  text: string;
  x: number;
  /** Counted from the bottom of the page, as in PDF. */
  y: number;
  width: number;
};

/** Items whose baselines differ by no more than this are on the same row. */
const ROW_TOLERANCE = 5;
/** A gap wider than this is a column break, not a space. */
const COLUMN_GAP = 12;

/**
 * Rebuilds the lines of a page from its text items, top to bottom, with a
 * wider gap (three spaces) where the items are far apart, so that the columns
 * of a ticket stay apart in the text.
 */
export const layoutPageLines = (items: readonly PdfTextItem[]): string[] => {
  const sorted = items
    .filter((item) => item.text.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: PdfTextItem[][] = [];
  let anchor = Number.NaN;
  for (const item of sorted) {
    if (rows.length > 0 && Math.abs(anchor - item.y) <= ROW_TOLERANCE) {
      rows[rows.length - 1]!.push(item);
    } else {
      rows.push([item]);
      anchor = item.y;
    }
  }

  return rows.map((row) => {
    const ordered = row.sort((a, b) => a.x - b.x);
    let line = '';
    let end = Number.NaN;
    for (const item of ordered) {
      const text = item.text.trim();
      if (line !== '') {
        const gap = item.x - end;
        line += gap > COLUMN_GAP ? '   ' : gap > 1 ? ' ' : '';
      }
      line += text;
      end = item.x + item.width;
    }
    return line;
  });
};

const MAX_PAGES = 20;

/**
 * The text of each page of a PDF, as lines (see `layoutPageLines`). It loads
 * pdf.js only when a PDF is actually read, and runs entirely in the browser.
 */
export const extractPdfPages = async (bytes: Uint8Array): Promise<string[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    ).default;
  }

  // pdf.js takes over the buffer, so it gets a copy.
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
  });
  const document = await task.promise;

  try {
    const pages: string[] = [];
    for (
      let number = 1;
      number <= Math.min(document.numPages, MAX_PAGES);
      number++
    ) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) =>
        'str' in item
          ? [
              {
                text: item.str,
                x: item.transform[4] as number,
                y: item.transform[5] as number,
                width: item.width,
              },
            ]
          : [],
      );
      pages.push(layoutPageLines(items).join('\n'));
    }
    return pages;
  } finally {
    await task.destroy();
  }
};
