import type { ApiScope } from './scopes';

export type ApiOperation = {
  /** Every call needs all of these; checked before the operation runs. */
  requires: readonly ApiScope[];
  /** Needed only for some targets or payloads; the service checks these. */
  conditional?: readonly ApiScope[];
  /** The MCP tool that exposes the same operation, if any. */
  mcpTool?: string;
};

const journeyWrite = [
  'journey.passengers.manage.own',
  'journey.passengers.manage.any',
  'tracks.write',
] as const satisfies readonly ApiScope[];

/*
 * The scope contract of every authenticated operation, keyed by its OpenAPI
 * operationId. REST routes and MCP tools enforce `requires` from here, and the
 * contract tests hold the OpenAPI document and the MCP docs to it.
 */
export const API_OPERATIONS = {
  'api-v1-get-me': {
    requires: ['profile.read'],
    mcpTool: 'traintrail_get_profile',
  },
  'api-v1-list-journeys': {
    requires: ['journey.read.own'],
    conditional: ['journey.read.any'],
    mcpTool: 'traintrail_list_journeys',
  },
  'api-v1-create-journey': {
    requires: ['journey.create.own'],
    conditional: ['journey.create.any', ...journeyWrite],
    mcpTool: 'traintrail_create_journey',
  },
  'api-v1-get-journey': {
    requires: ['journey.read.own'],
    conditional: ['journey.read.any'],
    mcpTool: 'traintrail_get_journey',
  },
  'api-v1-update-journey': {
    requires: ['journey.update.own'],
    conditional: ['journey.update.any', ...journeyWrite],
    mcpTool: 'traintrail_update_journey',
  },
  'api-v1-delete-journey': {
    requires: ['journey.delete.own'],
    conditional: ['journey.delete.any'],
    mcpTool: 'traintrail_delete_journey',
  },
  'api-v1-get-journey-track': {
    requires: ['tracks.read', 'journey.read.own'],
    conditional: ['journey.read.any'],
    mcpTool: 'traintrail_get_journey_track',
  },
  'api-v1-set-journey-track': {
    requires: ['tracks.write', 'journey.update.own'],
    conditional: ['journey.update.any'],
    mcpTool: 'traintrail_set_journey_track',
  },
  'api-v1-delete-journey-track': {
    requires: ['tracks.write', 'journey.update.own'],
    conditional: ['journey.update.any'],
    mcpTool: 'traintrail_delete_journey_track',
  },
  'api-v1-export-journeys': {
    requires: ['journey.export.own'],
    conditional: ['journey.export.any'],
    mcpTool: 'traintrail_export_journeys',
  },
  'api-v1-get-stats': {
    requires: ['stats.read', 'journey.read.own'],
    conditional: ['journey.read.any'],
    mcpTool: 'traintrail_get_stats',
  },
  'api-v1-search-stations': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_search_stations',
  },
  'api-v1-get-station': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_get_station',
  },
  'api-v1-search-operators': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_search_operators',
  },
  'api-v1-get-operator': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_get_operator',
  },
  'api-v1-search-train': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_search_train',
  },
  'api-v1-get-train': {
    requires: ['reference_data.read'],
    mcpTool: 'traintrail_get_train',
  },
  'api-v1-list-custom-fields': {
    requires: ['custom_fields.read'],
    mcpTool: 'traintrail_list_custom_fields',
  },
  'api-v1-update-preferences': {
    requires: ['preferences.write'],
    mcpTool: 'traintrail_update_preferences',
  },
  'api-v1-list-visited-countries': {
    requires: ['visited_countries.read'],
    mcpTool: 'traintrail_list_visited_countries',
  },
  'api-v1-set-visited-country': {
    requires: ['visited_countries.write'],
    mcpTool: 'traintrail_set_visited_country',
  },
  'api-v1-remove-visited-country': {
    requires: ['visited_countries.write'],
    mcpTool: 'traintrail_remove_visited_country',
  },
  'api-v1-list-shares': {
    requires: ['shares.read'],
    mcpTool: 'traintrail_list_shares',
  },
  'api-v1-create-share': {
    requires: ['shares.write'],
    mcpTool: 'traintrail_create_share',
  },
  'api-v1-update-share': {
    requires: ['shares.write'],
    mcpTool: 'traintrail_update_share',
  },
  'api-v1-delete-share': {
    requires: ['shares.write'],
    mcpTool: 'traintrail_delete_share',
  },
  'api-v1-list-users': { requires: ['users.directory.read'] },
  'api-v1-list-roles': { requires: ['roles.manage'] },
  'api-v1-create-role': { requires: ['roles.manage'] },
  'api-v1-update-role': { requires: ['roles.manage'] },
  'api-v1-delete-role': { requires: ['roles.manage'] },
} as const satisfies Record<string, ApiOperation>;

export type ApiOperationId = keyof typeof API_OPERATIONS;

export type McpOperationId = {
  [K in ApiOperationId]: (typeof API_OPERATIONS)[K] extends { mcpTool: string }
    ? K
    : never;
}[ApiOperationId];
