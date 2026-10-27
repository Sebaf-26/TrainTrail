import { describe, expect, it } from 'vitest';

import { forEachDelimitedRow } from './delimited-stream';

const streamOf = (text: string, chunkSize = text.length || 1) => {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
};

const readAll = async (text: string, chunkSize?: number, delimiter = ';') => {
  const rows: Record<string, string>[] = [];
  await forEachDelimitedRow(streamOf(text, chunkSize), delimiter, (row) => {
    rows.push(row);
  });
  return rows;
};

describe('forEachDelimitedRow', () => {
  it('reads rows keyed by the header with the given delimiter', async () => {
    expect(
      await readAll('id;name\n1;Milano Centrale\n2;Roma Termini\n'),
    ).toEqual([
      { id: '1', name: 'Milano Centrale' },
      { id: '2', name: 'Roma Termini' },
    ]);
  });

  it('supports other delimiters', async () => {
    expect(await readAll('a,b\n1,2\n', undefined, ',')).toEqual([
      { a: '1', b: '2' },
    ]);
  });

  it('handles quoted fields with delimiters, line breaks and escaped quotes', async () => {
    const text = 'name;note\n"x;y";"line1\nline2 ""q"""\n';
    expect(await readAll(text)).toEqual([
      { name: 'x;y', note: 'line1\nline2 "q"' },
    ]);
  });

  it('gives the same result whatever the chunk size', async () => {
    const text = 'name;note\n"Zürich;HB";"è ""ok""\nok"\nBasel;é\n';
    const expected = await readAll(text);

    expect(expected).toEqual([
      { name: 'Zürich;HB', note: 'è "ok"\nok' },
      { name: 'Basel', note: 'é' },
    ]);
    for (const size of [1, 2, 3, 7]) {
      expect(await readAll(text, size)).toEqual(expected);
    }
  });

  it('accepts CRLF line endings, blank lines and a missing final newline', async () => {
    expect(await readAll('a;b\r\n1;2\r\n\r\n3;4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('fills missing trailing cells with empty strings', async () => {
    expect(await readAll('a;b;c\n1;2\n')).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('strips a byte order mark from the first header', async () => {
    expect(await readAll('﻿id;name\n1;x\n')).toEqual([{ id: '1', name: 'x' }]);
  });

  it('rejects a file that ends inside a quoted field', async () => {
    await expect(readAll('a;b\n1;"never closed\n')).rejects.toThrow(
      'ended inside a quoted field',
    );
  });
});
