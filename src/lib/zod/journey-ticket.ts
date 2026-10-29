import { z } from 'zod';

import { BarcodeFormats } from '$lib/ticket/types';

/** The barcode of a ticket, as kept with a journey. The data is base64. */
export const journeyTicketInputSchema = z.object({
  barcodeFormat: z.enum(BarcodeFormats),
  barcodeData: z
    .string()
    .min(1)
    .max(8_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'The barcode data is not valid base64'),
  passengerName: z.string().max(100).nullable().default(null),
});
