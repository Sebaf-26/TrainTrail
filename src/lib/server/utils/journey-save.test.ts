import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiScope } from '$lib/api/v1/scopes';
import type { Permission } from '$lib/authorization/permissions';
import type { CreateJourney } from '$lib/db/types';
import { AuthorizationError } from '$lib/server/authorization/authorize';
import type { AuthorizationContext } from '$lib/server/authorization/context';

const mocks = vi.hoisted(() => ({
  getJourneyPrimitive: vi.fn(),
  journeyOwnership: vi.fn(),
  createJourneyPrimitiveWithConnection: vi.fn(),
  updateJourneyPrimitiveWithConnection: vi.fn(),
}));

vi.mock('$lib/db', () => ({
  db: {
    transaction: () => ({
      execute: (run: (trx: object) => unknown) => run({}),
    }),
  },
}));

vi.mock('$lib/db/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/db/queries')>()),
  getJourneyPrimitive: mocks.getJourneyPrimitive,
  createJourneyPrimitiveWithConnection:
    mocks.createJourneyPrimitiveWithConnection,
  updateJourneyPrimitiveWithConnection:
    mocks.updateJourneyPrimitiveWithConnection,
}));

vi.mock('$lib/server/authorization/journey', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('$lib/server/authorization/journey')
  >()),
  journeyOwnership: mocks.journeyOwnership,
}));

vi.mock('$lib/server/utils/custom-fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/utils/custom-fields')>()),
  prepareEntityCustomFieldPlan: async () => ({
    entityType: 'journey',
    definitions: [],
    entities: [],
  }),
  validateEntityCustomFieldPlan: () => {},
  persistEntityCustomFieldPlan: async () => {},
}));

const { saveJourneyAggregate } = await import('./journey');

const role = (...permissions: Permission[]): AuthorizationContext => ({
  userId: 'me',
  isOwner: false,
  roleId: 'role',
  roleName: 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

/** A writer whose credential holds `granted`, recording every scope checked. */
const writer = (
  authorization: AuthorizationContext,
  granted: ApiScope[] | 'all' = 'all',
) => {
  const checked: ApiScope[] = [];
  return {
    checked,
    authorization,
    requireScope: (scope: ApiScope) => {
      checked.push(scope);
      if (granted !== 'all' && !granted.includes(scope))
        throw new Error(`missing ${scope}`);
    },
  };
};

const passenger = (userId: string | null, id?: number) => ({
  ...(id === undefined ? {} : { id }),
  userId,
  guestName: userId ? null : 'Guest',
  seat: null,
  coach: null,
  seatNumber: null,
  seatClass: null,
  journeyReason: null,
});

const values = (
  passengers: ReturnType<typeof passenger>[],
  extra: Partial<CreateJourney> = {},
) => ({ passengers, ...extra }) as unknown as CreateJourney;

const create = (w: ReturnType<typeof writer>, journey: CreateJourney) =>
  saveJourneyAggregate(w, { id: null, values: journey, customFields: {} });
const update = (w: ReturnType<typeof writer>, journey: CreateJourney) =>
  saveJourneyAggregate(w, { id: 1, values: journey, customFields: {} });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createJourneyPrimitiveWithConnection.mockResolvedValue({
    journeyId: 7,
    passengers: [],
  });
  mocks.updateJourneyPrimitiveWithConnection.mockResolvedValue([]);
  mocks.getJourneyPrimitive.mockResolvedValue({
    id: 1,
    passengers: [passenger('me', 10)],
  });
  mocks.journeyOwnership.mockResolvedValue('own');
});

describe('creating a journey', () => {
  it('needs only create.own for a journey with just the caller', async () => {
    const w = writer(role('journey.create.own'));
    await expect(create(w, values([passenger('me')]))).resolves.toBe(7);
    expect(w.checked).toEqual(['journey.create.own']);
  });

  it('needs the passenger scope for a second passenger', async () => {
    const w = writer(
      role('journey.create.own', 'journey.passengers.manage.own'),
      ['journey.create.own'],
    );
    await expect(
      create(w, values([passenger('me'), passenger('other')])),
    ).rejects.toThrow('missing journey.passengers.manage.own');
    expect(mocks.createJourneyPrimitiveWithConnection).not.toHaveBeenCalled();
  });

  it('needs the .any scopes for a journey without the caller', async () => {
    const w = writer(
      role('journey.create.any', 'journey.passengers.manage.any'),
    );
    await create(w, values([passenger('a'), passenger('b')]));
    expect(w.checked).toEqual([
      'journey.create.any',
      'journey.passengers.manage.any',
    ]);
  });

  it('refuses a role that cannot create before checking the credential', async () => {
    const w = writer(role('journey.read.own'));
    await expect(create(w, values([passenger('me')]))).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(w.checked).toEqual([]);
  });

  it('treats a track in the payload, even null, as a track write', async () => {
    const w = writer(role('journey.create.own'), ['journey.create.own']);
    await expect(
      create(w, values([passenger('me')], { track: null })),
    ).rejects.toThrow('missing tracks.write');
  });
});

describe('updating a journey', () => {
  it('reports a missing journey as not found', async () => {
    mocks.getJourneyPrimitive.mockResolvedValue(undefined);
    const w = writer(role('journey.update.any'));
    await expect(
      update(w, values([passenger('me', 10)])),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("masks someone else's journey as not found for an own-only role", async () => {
    mocks.journeyOwnership.mockResolvedValue('any');
    const w = writer(role('journey.update.own'));
    await expect(
      update(w, values([passenger('me', 10)])),
    ).rejects.toMatchObject({ status: 404 });
    expect(w.checked).toEqual([]);
  });

  it('needs no passenger scope when passengers are unchanged', async () => {
    const w = writer(role('journey.update.own'));
    await expect(update(w, values([passenger('me', 10)]))).resolves.toBe(1);
    expect(w.checked).toEqual(['journey.update.own']);
  });

  it('needs the passenger scope when passengers change', async () => {
    const w = writer(
      role('journey.update.own', 'journey.passengers.manage.own'),
      ['journey.update.own'],
    );
    await expect(
      update(w, values([passenger('me', 10), passenger('other')])),
    ).rejects.toThrow('missing journey.passengers.manage.own');
    expect(mocks.updateJourneyPrimitiveWithConnection).not.toHaveBeenCalled();
  });

  it('masks a passenger change the role cannot make as not found', async () => {
    const w = writer(role('journey.update.own'));
    await expect(
      update(w, values([passenger('me', 10), passenger('other')])),
    ).rejects.toMatchObject({ status: 404 });
  });
});
