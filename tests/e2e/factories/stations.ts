import { db } from '@test/db';
import type { Station } from '$lib/db/types';

export interface StationInput {
  code: string;
  name: string;
  municipality?: string | null;
  lat: number;
  lon: number;
  country: string;
  continent: 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN';
  tz: string;
  type: 'main' | 'station';
  uic?: string | null;
  viaggiatrenoId?: string | null;
  custom?: boolean;
}

export const stationsFactory = {
  async getOrCreate(input: StationInput): Promise<{ station: Station }> {
    // Check if station already exists
    const existing = await db
      .selectFrom('station')
      .selectAll()
      .where('code', '=', input.code)
      .executeTakeFirst();

    if (existing) {
      return { station: existing };
    }

    // Create new station
    const result = await db
      .insertInto('station')
      .values({
        code: input.code,
        name: input.name,
        municipality: input.municipality ?? null,
        lat: input.lat,
        lon: input.lon,
        country: input.country,
        continent: input.continent,
        tz: input.tz,
        type: input.type,
        uic: input.uic ?? null,
        viaggiatrenoId: input.viaggiatrenoId ?? null,
        custom: input.custom ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { station: result };
  },
};
