type DelimitedRow = Record<string, string>;

/**
 * Streams a delimiter-separated file with RFC 4180 quoting and calls `onRow`
 * for every data row, keyed by the header row. Unlike `forEachCsvRow` the
 * delimiter is configurable and quoted fields may contain delimiters, line
 * breaks and escaped quotes, wherever the stream chunks happen to split them.
 */
export const forEachDelimitedRow = async (
  stream: ReadableStream<Uint8Array>,
  delimiter: string,
  onRow: (row: DelimitedRow) => Promise<void> | void,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let headers: string[] | null = null;
  let record: string[] = [];
  let field = '';
  let insideQuotes = false;
  // A quote inside a quoted field is either an escaped quote or the end of the
  // field; the next character decides.
  let quoteSeen = false;

  const endRecord = async () => {
    record.push(field);
    field = '';
    const values = record;
    record = [];

    if (values.length === 1 && values[0] === '') {
      return;
    }
    if (!headers) {
      headers = values;
      return;
    }

    const row: DelimitedRow = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? '';
    });
    await onRow(row);
  };

  const consume = async (text: string) => {
    for (const char of text) {
      if (insideQuotes) {
        if (quoteSeen) {
          quoteSeen = false;
          if (char === '"') {
            field += '"';
            continue;
          }
          insideQuotes = false;
        } else {
          if (char === '"') {
            quoteSeen = true;
          } else {
            field += char;
          }
          continue;
        }
      }

      if (char === '"' && field === '') {
        insideQuotes = true;
      } else if (char === delimiter) {
        record.push(field);
        field = '';
      } else if (char === '\n') {
        await endRecord();
      } else if (char !== '\r') {
        field += char;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    await consume(decoder.decode(value, { stream: true }));
  }

  await consume(decoder.decode());

  if (insideQuotes && !quoteSeen) {
    throw new Error('Delimited file ended inside a quoted field');
  }
  if (field !== '' || record.length > 0) {
    await endRecord();
  }
};
