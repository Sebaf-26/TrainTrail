import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { API_OPERATIONS, type ApiOperation } from '$lib/api/v1/operations';
import {
  API_SCOPES,
  MCP_DEFAULT_SCOPES,
  authorizationAllowsScope,
  journeyScope,
  journeyScopeOwnership,
  grantableScopes,
  grantableSubset,
  isApiScope,
  parseScopes,
  scopeDefinition,
  type ApiScope,
} from '$lib/api/v1/scopes';
import { journeyInputSchema } from '$lib/api/v1/schemas';
import { pkceChallenge } from '$lib/server/oauth/server';
import { effectiveApiPermissions } from '$lib/server/api/v1/access';
import { createMcpServer } from '$lib/server/mcp/server';
import { principalHasScope, type ApiPrincipal } from './principal';
import { encodeCursor } from './services/journey-page';
import { parsePage } from './query';
import {
  accessPresentation,
  accessSummary,
} from '$lib/authorization/access-presentation';
import {
  PERMISSIONS,
  PERMISSION_CATALOG,
} from '$lib/authorization/permissions';

const { parse } = createRequire(import.meta.url)('yaml') as {
  parse: (source: string) => Record<string, any>;
};
const spec = parse(
  readFileSync(join(process.cwd(), 'src/lib/api/v1/openapi.yaml'), 'utf8'),
);

const operations = Object.entries(API_OPERATIONS) as [string, ApiOperation][];

type DocumentedOperation = {
  path: string;
  method: string;
  operationId: string;
  security?: Record<string, string[]>[];
  'x-conditional-scopes'?: string[];
  responses: Record<string, unknown>;
};

const documentedOperations: DocumentedOperation[] = Object.entries(
  spec.paths as Record<string, Record<string, any>>,
).flatMap(([path, item]) =>
  ['get', 'post', 'put', 'delete']
    .filter((method) => item[method])
    .map((method) => ({ path, method, ...item[method] })),
);
const authenticated = documentedOperations.filter(
  (operation) => operation.security?.length !== 0,
);

const principal = (scopes: ApiScope[]): ApiPrincipal =>
  ({
    user: { id: 'u1' },
    authorization: {
      userId: 'u1',
      isOwner: true,
      roleId: null,
      roleName: null,
      roleAssignmentSource: 'local',
      permissions: new Set(),
    },
    credential: { kind: 'apiKey', keyId: 1, scopes: new Set(scopes) },
  }) as unknown as ApiPrincipal;

describe('operation registry', () => {
  it('documents every registered operation and nothing else', () => {
    expect(
      authenticated.map((operation) => operation.operationId).sort(),
    ).toEqual(Object.keys(API_OPERATIONS).sort());
  });

  it.each(authenticated)(
    '$operationId documents the registered scopes',
    (operation) => {
      const registered = API_OPERATIONS[
        operation.operationId as keyof typeof API_OPERATIONS
      ] as ApiOperation;
      expect(operation.security).toEqual([
        { bearerAuth: [...registered.requires] },
      ]);
      expect(operation['x-conditional-scopes']).toEqual(
        registered.conditional ? [...registered.conditional] : undefined,
      );
      expect(Object.keys(operation.responses)).toEqual(
        expect.arrayContaining(['401', '403']),
      );
    },
  );

  it('leaves no scope that no operation needs', () => {
    const used = new Set(
      operations.flatMap(([, operation]) => [
        ...operation.requires,
        ...(operation.conditional ?? []),
      ]),
    );
    expect(API_SCOPES.filter((scope) => !used.has(scope))).toEqual([]);
  });
});

/*
 * Every handler under /api/v1 is called without a credential. An `apiRoute`
 * handler answers 401 with a challenge naming its operation's scopes, so this
 * proves each route is built with `apiRoute` and declares the operation the
 * OpenAPI document gives it.
 */
describe('routes', () => {
  const modules = import.meta.glob<Record<string, unknown>>(
    '/src/routes/api/v1/**/+server.ts',
    { eager: true },
  );
  const routeHandlers = Object.entries(modules).flatMap(([file, module]) => {
    const path = file
      .replace('/src/routes', '')
      .replace(/\/\+server\.ts$/, '')
      .replace(/\[(\w+)\]/g, '{$1}');
    return Object.entries(module)
      .filter(([name]) => ['GET', 'POST', 'PUT', 'DELETE'].includes(name))
      .map(([method, handler]) => ({
        path,
        method: method.toLowerCase(),
        handler: handler as (event: unknown) => Promise<Response>,
      }));
  });
  const documented = (path: string, method: string) =>
    documentedOperations.find(
      (operation) => operation.path === path && operation.method === method,
    );

  it('matches the documented operations', () => {
    const routes = routeHandlers
      .filter(({ path }) => path !== '/api/v1/openapi.yaml')
      .map(({ path, method }) => `${method} ${path}`)
      .sort();
    expect(routes).toEqual(
      documentedOperations
        .map(({ path, method }) => `${method} ${path}`)
        .sort(),
    );
  });

  it.each(
    routeHandlers.filter(({ path, method }) => {
      const operation = documented(path, method);
      return operation !== undefined && operation.security?.length !== 0;
    }),
  )('$method $path challenges for its scopes', async (route) => {
    const operation = documented(route.path, route.method);
    expect(operation).toBeDefined();
    const url = new URL(
      `https://traintrail.example${route.path.replace('{id}', '1')}`,
    );
    const response = await route.handler({
      request: new Request(url, { method: route.method.toUpperCase() }),
      url,
      params: { id: '1' },
    });
    expect(response.status).toBe(401);
    const registered = API_OPERATIONS[
      operation!.operationId as keyof typeof API_OPERATIONS
    ] as ApiOperation;
    expect(response.headers.get('WWW-Authenticate')).toContain(
      `scope="${registered.requires.join(' ')}"`,
    );
  });
});

describe('mcp tools', () => {
  const connect = async (scopes: ApiScope[]) => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await createMcpServer(principal(scopes)).connect(serverTransport);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientTransport);
    return client;
  };
  const registeredTools = operations
    .map(([, operation]) => operation.mcpTool)
    .filter(Boolean)
    .sort();

  it('registers exactly the registry tools', async () => {
    const client = await connect([]);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(registeredTools);
  });

  it('requires the registered scopes before running', async () => {
    const client = await connect([]);
    const result = await client.callTool({
      name: 'traintrail_get_profile',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('profile.read');
  });

  it('runs with the registered scopes', async () => {
    const client = await connect(['profile.read']);
    const result = await client.callTool({
      name: 'traintrail_get_profile',
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
  });

  it('keeps the MCP default scopes usable by MCP tools', () => {
    const mcpScopes = new Set(
      operations
        .filter(([, operation]) => operation.mcpTool)
        .flatMap(([, operation]) => operation.requires),
    );
    for (const scope of MCP_DEFAULT_SCOPES) expect(mcpScopes).toContain(scope);
  });
});

describe('scope catalog', () => {
  it('rejects unknown scopes', () => {
    expect(isApiScope('journey.read.own')).toBe(true);
    expect(isApiScope('admin')).toBe(false);
    expect(parseScopes(['admin', 'profile.read', 'profile.read'])).toEqual([
      'profile.read',
    ]);
  });

  it('describes every scope', () => {
    for (const scope of API_SCOPES)
      expect(scopeDefinition(scope).description).toBeTruthy();
  });

  it('only lets a role without permissions grant capability scopes', () => {
    const nobody = { isOwner: false, permissions: [] as never[] };
    const allowed = API_SCOPES.filter((scope) =>
      authorizationAllowsScope(nobody, scope),
    );
    expect(allowed.sort()).toEqual(
      [
        'custom_fields.read',
        'preferences.write',
        'profile.read',
        'reference_data.read',
      ].sort(),
    );
  });

  it('accepts a requested set only when all of it is grantable', () => {
    const owner = { isOwner: true, permissions: [] as never[] };
    const nobody = { isOwner: false, permissions: [] as never[] };
    expect(grantableSubset(owner, ['journey.read.any'])).toEqual([
      'journey.read.any',
    ]);
    expect(grantableSubset(nobody, ['journey.read.any'])).toBeNull();
    expect(grantableSubset(owner, ['timetable.read'])).toBeNull();
  });

  it('marks read and export scopes read-only', () => {
    const readOnly = grantableScopes({ isOwner: true, permissions: [] })
      .filter((scope) => scope.readOnly)
      .map((scope) => scope.name);
    expect(readOnly).toContain('journey.export.any');
    expect(readOnly).toContain('stats.read');
    expect(readOnly).not.toContain('tracks.write');
  });
});

describe('principalHasScope', () => {
  it('treats .any as satisfying .own but not the reverse', () => {
    expect(
      principalHasScope(principal(['journey.read.any']), 'journey.read.own'),
    ).toBe(true);
    expect(
      principalHasScope(principal(['journey.read.own']), 'journey.read.any'),
    ).toBe(false);
    expect(
      principalHasScope(
        principal(['journey.passengers.manage.any']),
        'journey.passengers.manage.own',
      ),
    ).toBe(true);
  });

  it('does not broaden across resources', () => {
    expect(
      principalHasScope(principal(['journey.read.any']), 'journey.delete.own'),
    ).toBe(false);
    expect(principalHasScope(principal([]), 'profile.read')).toBe(false);
  });
});

describe('journey scope resolution', () => {
  it('builds the scope name for each action and ownership', () => {
    expect(journeyScope('read', 'own')).toBe('journey.read.own');
    expect(journeyScope('passengers.manage', 'any')).toBe(
      'journey.passengers.manage.any',
    );
  });

  it("counts only the caller's own journeys as own", () => {
    expect(journeyScopeOwnership({ scope: 'mine' }, 'u1')).toBe('own');
    expect(journeyScopeOwnership({ scope: 'user', userId: 'u1' }, 'u1')).toBe(
      'own',
    );
    expect(journeyScopeOwnership({ scope: 'user', userId: 'u2' }, 'u1')).toBe(
      'any',
    );
    expect(journeyScopeOwnership({ scope: 'all' }, 'u1')).toBe('any');
  });
});

describe('pagination', () => {
  it('round-trips a cursor', () => {
    const cursor = encodeCursor({ date: '2026-01-01', id: 42 });
    expect(parsePage('10', cursor)).toEqual({
      limit: 10,
      cursor: { date: '2026-01-01', id: 42 },
    });
  });

  it('rejects untrusted cursors', () => {
    for (const bad of ['not-base64!!', btoa('null'), btoa('{}'), btoa('[]')]) {
      expect(() => parsePage('10', bad)).toThrow();
    }
  });

  it('bounds the limit', () => {
    expect(parsePage(null, null)).toEqual({ limit: 50, cursor: null });
    expect(parsePage('1', null)).toEqual({ limit: 1, cursor: null });
    expect(parsePage('100', null)).toEqual({ limit: 100, cursor: null });
    for (const bad of ['0', '101', 'abc'])
      expect(() => parsePage(bad, null)).toThrow();
  });
});

describe('access presentation', () => {
  it('places every scope and permission', () => {
    for (const key of [
      ...API_SCOPES,
      ...PERMISSION_CATALOG.map((permission) => permission.key),
    ])
      expect(() => accessPresentation(key)).not.toThrow();
  });

  it('files instance settings and SQL under administration', () => {
    expect(accessPresentation('instance.map.manage').category).toBe(
      'Administration',
    );
    expect(accessPresentation('tools.sql.execute').category).toBe(
      'Administration',
    );
  });

  it('summarises read-only and read-write grants differently', () => {
    expect(accessSummary([])).toBe('No access');
    expect(accessSummary(['journey.read.own'])).toMatch(/^Read only/);
    expect(accessSummary(['journey.delete.own'])).toMatch(/^Read and write/);
  });

  it('ignores stored scopes that no longer exist', () => {
    expect(accessSummary(['timetable.read'])).toBe('No access');
    expect(accessSummary(['timetable.read', 'profile.read'])).toBe(
      'Read only · Profile (read)',
    );
  });
});

describe('input validation', () => {
  it('requires exactly one passenger identity', () => {
    const base = {
      date: '2026-01-01',
      fromId: 1,
      toId: 2,
      passengers: [{ userId: 'user-1', guestName: null }],
    };
    expect(journeyInputSchema.safeParse(base).success).toBe(true);
    expect(
      journeyInputSchema.safeParse({
        ...base,
        passengers: [{ userId: null, guestName: null }],
      }).success,
    ).toBe(false);
    expect(
      journeyInputSchema.safeParse({
        ...base,
        passengers: [{ userId: 'u', guestName: 'g' }],
      }).success,
    ).toBe(false);
  });
});

describe('oauth', () => {
  it('generates RFC 7636 S256 challenges', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('effective permissions', () => {
  it('reports every permission for owners and implied grants for roles', () => {
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'owner',
          isOwner: true,
          roleId: null,
          roleName: null,
          roleAssignmentSource: 'local',
          permissions: new Set(),
        },
      }),
    ).toEqual(PERMISSIONS);
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'admin',
          isOwner: false,
          roleId: 'role-admin',
          roleName: 'Admin',
          roleAssignmentSource: 'local',
          permissions: new Set(['journey.read.any']),
        },
      }),
    ).toEqual(expect.arrayContaining(['journey.read.any', 'journey.read.own']));
  });
});
