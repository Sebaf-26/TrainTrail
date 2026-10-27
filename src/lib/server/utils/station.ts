import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { db } from '$lib/db';
import { findStationsPrimitive } from '$lib/db/queries';
import type { Station, CreateStation } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { stationSchema } from '$lib/zod/station';

export const getStation = async (input: number): Promise<Station | null> => {
  return (
    (await db
      .selectFrom('station')
      .selectAll()
      .where('id', '=', input)
      .executeTakeFirst()) ?? null
  );
};

export const getStationByCode = async (
  input: string,
): Promise<Station | null> => {
  return (
    (await db
      .selectFrom('station')
      .selectAll()
      .where('code', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getStationByUic = async (
  input: string,
): Promise<Station | null> => {
  return (
    (await db
      .selectFrom('station')
      .selectAll()
      .where('uic', '=', input)
      .executeTakeFirst()) ?? null
  );
};

export const getStationByViaggiatrenoId = async (
  input: string,
): Promise<Station | null> => {
  return (
    (await db
      .selectFrom('station')
      .selectAll()
      .where('viaggiatrenoId', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findStations = async (input: string): Promise<Station[]> => {
  return await findStationsPrimitive(db, input);
};

export const createStation = async (data: CreateStation) => {
  await db.insertInto('station').values(data).execute();
};

export const updateStation = async (data: Station) => {
  await db.updateTable('station').set(data).where('id', '=', data.id).execute();
};

/** Custom stations get a generated code that cannot collide with a synced one. */
export const generateCustomStationCode = () =>
  `custom-${randomBytes(6).toString('hex')}`;

export const validateAndSaveStation = async (
  data: z.infer<typeof stationSchema>,
): Promise<ErrorActionResult> => {
  const { id, uic, municipality, ...fields } = data;
  const station = {
    ...fields,
    uic: uic || null,
    municipality: municipality || null,
  };

  if (id) {
    const existingStation = await getStation(id);
    if (!existingStation) {
      return { success: false, type: 'error', message: 'Station not found' };
    }
    if (!existingStation.custom) {
      return {
        success: false,
        type: 'error',
        message: 'Only custom stations can be edited',
      };
    }

    try {
      // The code and type of a custom station are fixed when it is created.
      await updateStation({ ...existingStation, ...station, id });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update station',
      };
    }

    return {
      success: true,
      message: 'Station updated',
    };
  }

  try {
    await createStation({
      ...station,
      code: generateCustomStationCode(),
      type: 'station',
      custom: true,
    });
  } catch {
    return {
      success: false,
      type: 'error',
      message: 'Failed to create station',
    };
  }

  return {
    success: true,
    message: 'Station created',
  };
};
