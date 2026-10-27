import type { Selectable } from 'kysely';
import type {
  custom_field_definition,
  public_share,
  visited_country,
} from '$lib/db/schema';
import type {
  Train,
  Operator,
  Station,
  Journey,
  JourneyPassenger,
  User,
} from '$lib/db/types';

export const toStationDto = (station: Station | null) =>
  station
    ? {
        id: station.id,
        code: station.code,
        uic: station.uic,
        viaggiatrenoId: station.viaggiatrenoId,
        name: station.name,
        municipality: station.municipality,
        latitude: station.lat,
        longitude: station.lon,
        timezone: station.tz,
        type: station.type,
        continent: station.continent,
        country: station.country,
        custom: station.custom,
      }
    : null;

export const toOperatorDto = (operator: Operator | null) =>
  operator
    ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
        iconPath: operator.iconPath,
      }
    : null;

export const toTrainDto = (train: Train | null) =>
  train
    ? {
        id: train.id,
        name: train.name,
        code: train.code,
      }
    : null;

export const toUserDto = (user: User) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
});

export const toPassengerDto = (passenger: JourneyPassenger) => ({
  id: passenger.id,
  user: passenger.user,
  guestName: passenger.guestName,
  seat: passenger.seat,
  coach: passenger.coach,
  seatNumber: passenger.seatNumber,
  seatClass: passenger.seatClass,
  journeyReason: passenger.journeyReason,
});

export type JourneyTrackSummary = {
  pointCount: number;
  updatedAt: string;
  sourceFormat: string;
  sourceName: string | null;
};

export const toJourneyDto = (
  journey: Journey,
  track: JourneyTrackSummary | null = null,
) => ({
  id: journey.id,
  date: journey.date,
  datePrecision: journey.datePrecision,
  departure: journey.departure,
  arrival: journey.arrival,
  departureScheduled: journey.departureScheduled,
  arrivalScheduled: journey.arrivalScheduled,
  duration: journey.duration,
  departurePlatform: journey.departurePlatform,
  arrivalPlatform: journey.arrivalPlatform,
  trainNumber: journey.trainNumber,
  unitNumber: journey.unitNumber,
  note: journey.note,
  from: toStationDto(journey.from),
  to: toStationDto(journey.to),
  operator: toOperatorDto(journey.operator),
  train: toTrainDto(journey.train),
  passengers: journey.passengers.map(toPassengerDto),
  track,
});

/*
 * Explicit projections, so a new column (or `userId`) never becomes part of the
 * public contract by accident.
 */
export const toShareDto = (share: Selectable<public_share>) => ({
  id: share.id,
  slug: share.slug,
  expiresAt: share.expiresAt,
  createdAt: share.createdAt,
  showMap: share.showMap,
  showStats: share.showStats,
  showJourneyList: share.showJourneyList,
  dateFrom: share.dateFrom,
  dateTo: share.dateTo,
  showTrainNumbers: share.showTrainNumbers,
  showOperators: share.showOperators,
  showTrain: share.showTrain,
  showTimes: share.showTimes,
  showTracks: share.showTracks,
  showDates: share.showDates,
  showSeat: share.showSeat,
});

export const toVisitedCountryDto = (country: Selectable<visited_country>) => ({
  id: country.id,
  code: country.code,
  status: country.status,
  note: country.note,
});

export const toCustomFieldDto = (
  field: Selectable<custom_field_definition>,
) => ({
  id: field.id,
  entityType: field.entityType,
  key: field.key,
  label: field.label,
  description: field.description,
  fieldType: field.fieldType,
  required: field.required,
  order: field.order,
  defaultValue: field.defaultValue,
  options: field.options,
});
