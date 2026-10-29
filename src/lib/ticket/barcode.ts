import { toSVG } from 'bwip-js/browser';

import type { BarcodeFormat } from './types';

const SYMBOLS: Record<BarcodeFormat, string> = {
  aztec: 'azteccode',
  qr: 'qrcode',
  pdf417: 'pdf417',
  code128: 'code128',
};

export const barcodeFormatLabels: Record<BarcodeFormat, string> = {
  aztec: 'Aztec',
  qr: 'QR',
  pdf417: 'PDF417',
  code128: 'Code 128',
};

/** The characters of a base64 string as the bytes they stand for. */
const toBinaryString = (base64: string) =>
  Array.from(atob(base64), (char) => char.charAt(0)).join('');

/**
 * Draws a ticket barcode in the format it was issued in, from the raw bytes of
 * its message, as an SVG image URL. The symbol is never converted to another
 * one: the scanner that checks the ticket expects the original format.
 */
export const barcodeImageUrl = (format: BarcodeFormat, base64: string) => {
  const svg = toSVG({
    bcid: SYMBOLS[format],
    text: toBinaryString(base64),
    // The message of a rail ticket is binary: each character is one byte.
    ...(format === 'code128' ? { height: 14 } : { binarytext: true }),
    scale: 4,
    includetext: false,
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
