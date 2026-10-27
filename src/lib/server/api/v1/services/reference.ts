import { db } from '$lib/db';
import { toTrainDto, toOperatorDto, toStationDto } from '$lib/api/v1/dto';
import { findTrain } from '$lib/server/utils/train';
import { findOperator } from '$lib/server/utils/operator';
import { findStations } from '$lib/server/utils/station';
import { ApiOperationError } from '../errors';

export const searchStations = async (query: string) =>
  (await findStations(query)).map(toStationDto);

export const searchOperators = async (query: string) =>
  ((await findOperator(query)) ?? []).map(toOperatorDto);

export const searchTrain = async (query: string) =>
  ((await findTrain(query)) ?? []).map(toTrainDto);

const getReferenceRow = async <T>(
  load: () => Promise<T | null>,
  label: string,
): Promise<T> => {
  const row = await load();
  if (!row) throw new ApiOperationError('not_found', `${label} not found`);
  return row;
};

export const getStation = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('station')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toStationDto(row) : null;
  }, 'Station');

export const getOperator = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('operator')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toOperatorDto(row) : null;
  }, 'Operator');

export const getTrain = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('train')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toTrainDto(row) : null;
  }, 'Train');
