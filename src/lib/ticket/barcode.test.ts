import { describe, expect, it } from 'vitest';

import { barcodeImageUrl } from './barcode';
import { BarcodeFormats } from './types';

const svgOf = (url: string) =>
  decodeURIComponent(url.slice(url.indexOf(',') + 1));

// Bytes that a text encoding would change: 0x00, 0x14 and everything above 0x7f.
const BINARY = btoa(String.fromCharCode(0x20, 0x14, 0xc2, 0x08, 0x00, 0xff));

describe('barcodeImageUrl', () => {
  it.each(BarcodeFormats)('draws a %s barcode as an SVG image', (format) => {
    const url = barcodeImageUrl(format, BINARY);

    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(svgOf(url)).toContain('<svg');
  });

  it('draws different symbols for different data', () => {
    const other = btoa(String.fromCharCode(0x20, 0x14, 0xc2, 0x08, 0x00, 0xfe));

    expect(svgOf(barcodeImageUrl('aztec', other))).not.toBe(
      svgOf(barcodeImageUrl('aztec', BINARY)),
    );
  });
});
