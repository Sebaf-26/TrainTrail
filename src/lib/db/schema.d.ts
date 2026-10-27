import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type access_role = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Generated<Timestamp>;
    updatedAt: Generated<Timestamp>;
};
export type access_role_permission = {
    roleId: string;
    permission: string;
};
export type api_key = {
    id: Generated<number>;
    name: string;
    userId: string;
    key: string;
    createdAt: Generated<Timestamp>;
    lastUsed: Timestamp | null;
    scopes: string[];
};
export type app_config = {
    id: Generated<number>;
    config: Generated<unknown>;
};
export type authorization_settings = {
    id: Generated<number>;
    defaultRoleId: string;
    /**
     * @kyselyType('off' | 'on_create' | 'on_login')
     */
    oauthRoleMappingMode: Generated<'off' | 'on_create' | 'on_login'>;
};
export type custom_field_definition = {
    id: Generated<number>;
    /**
     * @kyselyType('journey' | 'journey_passenger')
     */
    entityType: 'journey' | 'journey_passenger';
    key: string;
    label: string;
    description: string | null;
    /**
     * @kyselyType('text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'multi-select' | 'station' | 'operator' | 'train')
     */
    fieldType: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'multi-select' | 'station' | 'operator' | 'train';
    required: Generated<boolean>;
    active: Generated<boolean>;
    order: Generated<number>;
    defaultValue: unknown | null;
    options: unknown | null;
    validationJson: unknown | null;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type custom_field_value = {
    id: Generated<number>;
    fieldId: number;
    /**
     * @kyselyType('journey' | 'journey_passenger')
     */
    entityType: 'journey' | 'journey_passenger';
    entityId: string;
    value: unknown;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type journey = {
    id: Generated<number>;
    date: string;
    /**
     * @kyselyType('day' | 'month' | 'year')
     */
    datePrecision: Generated<'day' | 'month' | 'year'>;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    departure: string | null;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    arrival: string | null;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    departureScheduled: string | null;
    /**
     * YYYY-MM-DDTHH:mm:ss.sssZ (ISO-8601)
     */
    arrivalScheduled: string | null;
    duration: number | null;
    departurePlatform: string | null;
    arrivalPlatform: string | null;
    trainNumber: string | null;
    unitNumber: string | null;
    note: string | null;
    fromId: number | null;
    toId: number | null;
    trainId: number | null;
    operatorId: number | null;
};
export type journey_passenger = {
    id: Generated<number>;
    journeyId: number;
    userId: string | null;
    guestName: string | null;
    /**
     * @kyselyType('window' | 'aisle' | 'table' | 'standing' | 'other')
     */
    seat: 'window' | 'aisle' | 'table' | 'standing' | 'other' | null;
    /**
     * Coach number or name (e.g. 7)
     */
    coach: string | null;
    /**
     * Seat number (e.g. 12A)
     */
    seatNumber: string | null;
    /**
     * @kyselyType('second' | 'first' | 'business' | 'premium' | 'sleeper')
     */
    seatClass: 'second' | 'first' | 'business' | 'premium' | 'sleeper' | null;
    /**
     * @kyselyType('leisure' | 'business' | 'commute' | 'other')
     */
    journeyReason: 'leisure' | 'business' | 'commute' | 'other' | null;
};
export type journey_track = {
    journeyId: number;
    track: unknown;
    /**
     * @kyselyType('gpx' | 'kml' | 'csv' | 'readsb')
     */
    sourceFormat: 'gpx' | 'kml' | 'csv' | 'readsb';
    sourceName: string | null;
    pointCount: number;
    createdAt: Generated<Timestamp>;
    updatedAt: Generated<Timestamp>;
};
export type oauth_access_token = {
    tokenHash: string;
    clientId: string;
    userId: string;
    grantId: string;
    refreshFamilyId: string | null;
    scopes: string[];
    resource: string;
    expiresAt: Timestamp;
    revokedAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
};
export type oauth_authorization_code = {
    codeHash: string;
    clientId: string;
    userId: string;
    grantId: string;
    redirectUri: string;
    scopes: string[];
    resource: string;
    codeChallenge: string;
    expiresAt: Timestamp;
    usedAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
};
export type oauth_authorization_request = {
    id: string;
    clientId: string;
    userId: string | null;
    redirectUri: string;
    scopes: string[];
    resource: string;
    state: string | null;
    codeChallenge: string;
    expiresAt: Timestamp;
    createdAt: Generated<Timestamp>;
};
export type oauth_client = {
    id: string;
    name: string;
    clientSecretHash: string | null;
    tokenEndpointAuthMethod: Generated<string>;
    createdAt: Generated<Timestamp>;
};
export type oauth_client_redirect_uri = {
    clientId: string;
    redirectUri: string;
};
export type oauth_grant = {
    id: string;
    clientId: string;
    userId: string;
    resource: string;
    scopes: string[];
    createdAt: Generated<Timestamp>;
    updatedAt: Generated<Timestamp>;
};
export type oauth_link_token = {
    id: string;
    token: string;
    userId: string;
    oauthSub: string;
    expiresAt: Timestamp;
    createdAt: Generated<Timestamp>;
};
export type oauth_refresh_token = {
    tokenHash: string;
    clientId: string;
    userId: string;
    grantId: string;
    familyId: string;
    scopes: string[];
    resource: string;
    expiresAt: Timestamp;
    usedAt: Timestamp | null;
    revokedAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
};
export type oauth_role_mapping = {
    id: Generated<number>;
    priority: number;
    name: Generated<string>;
    enabled: Generated<boolean>;
    /**
     * @kyselyType('userinfo' | 'id_token')
     */
    claimSource: 'userinfo' | 'id_token';
    claimPath: string;
    /**
     * @kyselyType('equals' | 'contains')
     */
    operator: 'equals' | 'contains';
    claimValue: string;
    roleId: string;
};
export type operator = {
    id: Generated<number>;
    name: string;
    code: string | null;
    iconPath: string | null;
    sourceId: string | null;
};
export type public_share = {
    id: Generated<number>;
    userId: string;
    slug: string;
    expiresAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
    showMap: Generated<boolean>;
    showStats: Generated<boolean>;
    showJourneyList: Generated<boolean>;
    dateFrom: string | null;
    dateTo: string | null;
    showTrainNumbers: Generated<boolean>;
    showOperators: Generated<boolean>;
    showTrain: Generated<boolean>;
    showTimes: Generated<boolean>;
    showTracks: Generated<boolean>;
    showDates: Generated<boolean>;
    showSeat: Generated<boolean>;
};
export type session = {
    id: string;
    expiresAt: Timestamp;
    userId: string;
};
export type station = {
    id: Generated<number>;
    code: string;
    /**
     * UIC location code, when known
     */
    uic: string | null;
    /**
     * ViaggiaTreno (Trenitalia/RFI) station id, e.g. S01700
     */
    viaggiatrenoId: string | null;
    lat: number;
    lon: number;
    tz: string;
    name: string;
    municipality: string | null;
    /**
     * @kyselyType('main' | 'station')
     */
    type: 'main' | 'station';
    /**
     * @kyselyType('EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN')
     */
    continent: 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN';
    country: string;
    custom: Generated<boolean>;
};
export type train = {
    id: Generated<number>;
    name: string;
    code: string | null;
    sourceId: string | null;
};
export type user = {
    id: string;
    username: string;
    displayName: string;
    password: string | null;
    roleId: string | null;
    isOwner: Generated<boolean>;
    /**
     * @kyselyType('local' | 'oauth')
     */
    roleAssignmentSource: Generated<'local' | 'oauth'>;
    oauthId: string | null;
    /**
     * @kyselyType('km' | 'mi')
     */
    distanceUnit: Generated<'km' | 'mi'>;
    /**
     * @kyselyType('12h' | '24h' | 'auto')
     */
    timeFormat: Generated<'12h' | '24h' | 'auto'>;
    /**
     * @kyselyType('iso' | 'us' | 'eu' | 'auto')
     */
    dateFormat: Generated<'iso' | 'us' | 'eu' | 'auto'>;
    /**
     * @kyselyType('mon' | 'sun' | 'auto')
     */
    weekStartsOn: Generated<'mon' | 'sun' | 'auto'>;
    /**
     * @kyselyType('station' | 'utc' | 'system')
     */
    journeyTimeDisplay: Generated<'station' | 'utc' | 'system'>;
};
export type visited_country = {
    id: Generated<number>;
    /**
     * ISO 3166-1 alpha-2 or EU user-assigned country code
     */
    code: string;
    /**
     * @kyselyType('lived' | 'visited' | 'layover' | 'wishlist')
     */
    status: 'lived' | 'visited' | 'layover' | 'wishlist';
    note: string | null;
    userId: string;
};
export type DB = {
    accessRole: access_role;
    accessRolePermission: access_role_permission;
    apiKey: api_key;
    appConfig: app_config;
    authorizationSettings: authorization_settings;
    customFieldDefinition: custom_field_definition;
    customFieldValue: custom_field_value;
    journey: journey;
    journeyPassenger: journey_passenger;
    journeyTrack: journey_track;
    oauthAccessToken: oauth_access_token;
    oauthAuthorizationCode: oauth_authorization_code;
    oauthAuthorizationRequest: oauth_authorization_request;
    oauthClient: oauth_client;
    oauthClientRedirectUri: oauth_client_redirect_uri;
    oauthGrant: oauth_grant;
    oauthLinkToken: oauth_link_token;
    oauthRefreshToken: oauth_refresh_token;
    oauthRoleMapping: oauth_role_mapping;
    operator: operator;
    publicShare: public_share;
    session: session;
    station: station;
    train: train;
    user: user;
    visitedCountry: visited_country;
};
