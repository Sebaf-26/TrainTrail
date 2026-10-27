import type {
  train,
  operator,
  station,
  api_key,
  journey,
  journey_track,
  public_share,
  journey_passenger,
  user,
  visited_country,
} from '$lib/db/schema';
import type { JourneyTrackInput } from '$lib/track/schema';
import type { Insertable, Kysely, Selectable, Transaction } from 'kysely';
import type { DB } from '$lib/db/schema';

/** Either a pooled connection or an open transaction. */
export type DatabaseConnection = Kysely<DB> | Transaction<DB>;

export type FullUser = Selectable<user>;
export type User = Omit<FullUser, 'password'>;
export const publicUserFields = [
  'id',
  'username',
  'displayName',
  'roleId',
  'isOwner',
  'roleAssignmentSource',
  'distanceUnit',
  'timeFormat',
  'dateFormat',
  'weekStartsOn',
  'journeyTimeDisplay',
] as const satisfies readonly (keyof User)[];
export type PublicUser = Pick<User, (typeof publicUserFields)[number]> & {
  roleName: string | null;
};
export type DirectoryUser = PublicUser & { canManage: boolean };
export type PageUser = PublicUser & { hasOAuthLinked: boolean };
export type ApiKey = Omit<Selectable<api_key>, 'key' | 'userId'>;
export type Train = Selectable<train>;
export type Operator = Selectable<operator>;
export type Station = Selectable<station>;
export type CreateStation = Insertable<station>;
export type JourneyPassengerRecord = Selectable<journey_passenger>;
export type JourneyPassenger = JourneyPassengerRecord & {
  user: Pick<User, 'id' | 'displayName' | 'username'> | null;
};
export type Journey = Omit<
  Selectable<journey>,
  'fromId' | 'toId' | 'trainId' | 'operatorId'
> & {
  from: Station | null;
  to: Station | null;
  passengers: JourneyPassenger[];
  train: Train | null;
  operator: Operator | null;
};
export type JourneyTrack = Selectable<journey_track>;
type CreateJourneyStation = Partial<Station>;
type CreateJourneyEntityReference<T extends { id: number }> = Omit<
  Partial<T>,
  'id'
> & { id: number | null };
export type CreateJourneyPassenger = Omit<
  JourneyPassengerRecord,
  'journeyId' | 'id'
> & {
  id?: number;
  customFields?: Record<string, unknown>;
};
type JourneyRecord = Omit<
  Selectable<journey>,
  'id' | 'fromId' | 'toId' | 'trainId' | 'operatorId'
>;
export type CreateJourney = JourneyRecord & {
  from: CreateJourneyStation | null;
  to: CreateJourneyStation | null;
  train: CreateJourneyEntityReference<Train> | null;
  operator: CreateJourneyEntityReference<Operator> | null;
  passengers: CreateJourneyPassenger[];
  track?: JourneyTrackInput | null;
};
export type PublicShare = Selectable<public_share>;
export type VisitedCountry = Selectable<visited_country>;

export function wasVisited(country: Pick<VisitedCountry, 'status'>): boolean {
  return country.status === 'visited' || country.status === 'lived';
}

export const StationTypes = ['main', 'station'] as const;
export const Continents = ['AF', 'AS', 'EU', 'NA', 'OC', 'SA', 'AN'] as const;
export const ContinentMap = {
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  AS: 'Asia',
  AF: 'Africa',
  OC: 'Oceania',
  AN: 'Antarctica',
};

export const SeatTypes = [
  'window',
  'aisle',
  'table',
  'standing',
  'other',
] as const;
export const SeatClasses = [
  'second',
  'first',
  'business',
  'premium',
  'sleeper',
] as const;
export const JourneyReasons = [
  'leisure',
  'business',
  'commute',
  'other',
] as const;
export const JourneyDatePrecisions = ['day', 'month', 'year'] as const;
export type JourneyDatePrecision = (typeof JourneyDatePrecisions)[number];

export const VisitedCountryStatus = [
  'lived',
  'visited',
  'layover',
  'wishlist',
] as const;
