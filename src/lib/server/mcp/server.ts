import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import {
  journeyInputSchema,
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import { updatePreferencesSchema } from '$lib/zod/user';
import { journeyTrackInputSchema } from '$lib/track/schema';
import { requireOperation } from '$lib/server/api/v1/access';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { parseJourneyScope, parsePage } from '$lib/server/api/v1/query';
import {
  createJourney,
  deleteJourney,
  exportJourneys,
  getJourney,
  getJourneyStats,
  listJourneys,
  updateJourney,
} from '$lib/server/api/v1/services/journeys';
import {
  deleteJourneyTrack,
  getJourneyTrack,
  setJourneyTrack,
} from '$lib/server/api/v1/services/tracks';
import {
  createShare,
  deleteShare,
  listCustomFields,
  listShares,
  listVisitedCountries,
  removeVisitedCountry,
  setVisitedCountry,
  updatePreferences,
  updateShare,
} from '$lib/server/api/v1/services/personal';
import { getProfile } from '$lib/server/api/v1/services/profile';
import {
  getTrain,
  getOperator,
  getStation,
  searchTrain,
  searchOperators,
  searchStations,
} from '$lib/server/api/v1/services/reference';
import { operationTools } from './tool';

const idInput = { id: z.number().int().positive() };
const queryInput = { query: z.string().min(1) };
const noInput = {};
/** The same `scope`/`userId` pair the REST query string takes. */
const journeyScopeInput = {
  scope: z.enum(['mine', 'user', 'all']).default('mine'),
  userId: z.string().min(1).optional(),
};
const destructive = { annotations: { destructiveHint: true } } as const;

const toJourneyScope = ({
  scope,
  userId,
}: {
  scope: string;
  userId?: string;
}) =>
  parseJourneyScope(
    new URLSearchParams({ scope, ...(userId ? { userId } : {}) }),
  );

export const createMcpServer = (principal: ApiPrincipal) => {
  const server = new McpServer({ name: 'traintrail', version: '1.0.0' });
  const tool = operationTools(server, principal);

  tool(
    'api-v1-get-me',
    {
      description: 'Get the authenticated TrainTrail profile',
      inputSchema: noInput,
    },
    'Unable to load profile',
    () => getProfile(principal),
  );

  tool(
    'api-v1-list-journeys',
    {
      description: 'List visible TrainTrail journeys',
      inputSchema: {
        ...journeyScopeInput,
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().nullable().optional(),
      },
    },
    'Unable to list journeys',
    ({ limit, cursor, ...scope }) =>
      listJourneys(
        principal,
        toJourneyScope(scope),
        parsePage(limit, cursor ?? null),
      ),
  );

  tool(
    'api-v1-get-journey',
    { description: 'Get one visible TrainTrail journey', inputSchema: idInput },
    'Unable to load journey',
    ({ id }) => getJourney(principal, id),
  );

  tool(
    'api-v1-create-journey',
    {
      description: 'Create a TrainTrail journey',
      inputSchema: journeyInputSchema,
    },
    'Unable to create journey',
    async (input) => ({ id: await createJourney(principal, input) }),
  );

  tool(
    'api-v1-update-journey',
    {
      description: 'Replace a TrainTrail journey',
      inputSchema: journeyInputSchema.extend(idInput),
    },
    'Unable to update journey',
    ({ id, ...input }) => updateJourney(principal, id, input),
  );

  tool(
    'api-v1-delete-journey',
    {
      description: 'Delete a TrainTrail journey',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete journey',
    async ({ id }) => {
      await deleteJourney(principal, id);
      return { id, deleted: true };
    },
  );

  tool(
    'api-v1-export-journeys',
    {
      description: 'Export visible journeys as a backup document',
      inputSchema: journeyScopeInput,
    },
    'Unable to export journeys',
    (scope) => exportJourneys(principal, toJourneyScope(scope)),
  );

  tool(
    'api-v1-get-journey-track',
    { description: 'Get a journey track', inputSchema: idInput },
    'Unable to load track',
    ({ id }) => getJourneyTrack(principal, id),
  );

  tool(
    'api-v1-set-journey-track',
    {
      description: 'Replace a journey track',
      inputSchema: journeyTrackInputSchema.extend(idInput),
    },
    'Unable to save track',
    ({ id, ...track }) => setJourneyTrack(principal, id, track),
  );

  tool(
    'api-v1-delete-journey-track',
    {
      description: 'Delete a journey track',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete track',
    async ({ id }) => {
      await deleteJourneyTrack(principal, id);
      return { id, deleted: true };
    },
  );

  tool(
    'api-v1-get-stats',
    { description: 'Get journey statistics', inputSchema: journeyScopeInput },
    'Unable to load statistics',
    (scope) => getJourneyStats(principal, toJourneyScope(scope)),
  );

  tool(
    'api-v1-search-stations',
    {
      description:
        'Search railway stations by name, station code, UIC code or ViaggiaTreno id',
      inputSchema: queryInput,
    },
    'Unable to search stations',
    ({ query }) => searchStations(query),
  );
  tool(
    'api-v1-get-station',
    { description: 'Get a station by id', inputSchema: idInput },
    'Unable to load station',
    ({ id }) => getStation(id),
  );
  tool(
    'api-v1-search-operators',
    { description: 'Search operators', inputSchema: queryInput },
    'Unable to search operators',
    ({ query }) => searchOperators(query),
  );
  tool(
    'api-v1-get-operator',
    { description: 'Get an operator by id', inputSchema: idInput },
    'Unable to load operator',
    ({ id }) => getOperator(id),
  );
  tool(
    'api-v1-search-train',
    {
      description: 'Search train models (e.g. Frecciarossa 1000)',
      inputSchema: queryInput,
    },
    'Unable to search train',
    ({ query }) => searchTrain(query),
  );
  tool(
    'api-v1-get-train',
    { description: 'Get a train model by id', inputSchema: idInput },
    'Unable to load train',
    ({ id }) => getTrain(id),
  );

  tool(
    'api-v1-list-custom-fields',
    {
      description: 'List active custom field definitions',
      inputSchema: noInput,
    },
    'Unable to load custom fields',
    () => listCustomFields(),
  );

  tool(
    'api-v1-update-preferences',
    {
      description: 'Update profile preferences',
      inputSchema: updatePreferencesSchema,
    },
    'Unable to update preferences',
    (input) => updatePreferences(principal, input),
  );

  tool(
    'api-v1-list-visited-countries',
    { description: 'List personal visited countries', inputSchema: noInput },
    'Unable to load countries',
    () => listVisitedCountries(principal),
  );
  tool(
    'api-v1-set-visited-country',
    {
      description: 'Create or update a visited country',
      inputSchema: visitedCountryInputSchema,
    },
    'Unable to save country',
    (input) => setVisitedCountry(principal, input),
  );
  tool(
    'api-v1-remove-visited-country',
    {
      description: 'Remove a visited country',
      inputSchema: { code: z.string().length(2) },
      ...destructive,
    },
    'Unable to remove country',
    async ({ code }) => ({
      code: await removeVisitedCountry(principal, code),
      deleted: true,
    }),
  );

  tool(
    'api-v1-list-shares',
    { description: 'List personal public shares', inputSchema: noInput },
    'Unable to load shares',
    () => listShares(principal),
  );
  tool(
    'api-v1-create-share',
    { description: 'Create a public share', inputSchema: shareInputSchema },
    'Unable to create share',
    (input) => createShare(principal, input),
  );
  tool(
    'api-v1-update-share',
    {
      description: 'Replace a public share',
      inputSchema: shareInputSchema.extend(idInput),
    },
    'Unable to update share',
    ({ id, ...input }) => updateShare(principal, id, input),
  );
  tool(
    'api-v1-delete-share',
    {
      description: 'Delete a public share',
      inputSchema: idInput,
      ...destructive,
    },
    'Unable to delete share',
    async ({ id }) => {
      await deleteShare(principal, id);
      return { id, deleted: true };
    },
  );

  server.registerResource(
    'traintrail-profile',
    'traintrail://profile',
    { mimeType: 'application/json' },
    async () => {
      requireOperation(principal, 'api-v1-get-me');
      return {
        contents: [
          {
            uri: 'traintrail://profile',
            mimeType: 'application/json',
            text: JSON.stringify(getProfile(principal)),
          },
        ],
      };
    },
  );

  return server;
};

export const handleMcpRequest = async (
  request: Request,
  principal: ApiPrincipal,
) => {
  const server = createMcpServer(principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, {
      authInfo: {
        token: 'redacted',
        clientId:
          principal.credential.kind === 'oauth'
            ? principal.credential.clientId
            : `api-key:${principal.credential.keyId}`,
        scopes: [...principal.credential.scopes],
        resource:
          principal.credential.kind === 'oauth'
            ? new URL(principal.credential.resource)
            : undefined,
      },
    });
  } finally {
    await transport.close();
    await server.close();
  }
};
