import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
}));

vi.mock('$lib/db', () => ({
  db: {
    selectFrom: () => ({
      selectAll: () => ({
        where: () => ({ executeTakeFirst: mocks.executeTakeFirst }),
      }),
    }),
    insertInto: () => ({
      values: (values: unknown) => {
        mocks.insertValues(values);
        return { execute: async () => undefined };
      },
    }),
    updateTable: () => ({
      set: (values: unknown) => {
        mocks.updateSet(values);
        return { where: () => ({ execute: async () => undefined }) };
      },
    }),
  },
}));

const { generateCustomStationCode, validateAndSaveStation } =
  await import('./station');

const form = {
  id: null,
  name: 'Fermata Esempio',
  municipality: '',
  lat: 45.1,
  lon: 9.1,
  continent: 'EU',
  country: 'IT',
  uic: '',
  tz: 'Europe/Rome',
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('custom station codes', () => {
  it('are random and prefixed with custom-', () => {
    const first = generateCustomStationCode();
    const second = generateCustomStationCode();

    expect(first).toMatch(/^custom-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});

describe('validateAndSaveStation', () => {
  it('creates a custom station with a generated code and the station type', async () => {
    const result = await validateAndSaveStation({ ...form });

    expect(result).toMatchObject({ success: true, message: 'Station created' });
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    const values = mocks.insertValues.mock.calls[0]![0];
    expect(values).toMatchObject({
      name: 'Fermata Esempio',
      municipality: null,
      uic: null,
      type: 'station',
      custom: true,
    });
    expect(values.code).toMatch(/^custom-/);
    expect(values).not.toHaveProperty('id');
  });

  it('keeps the code and type of an existing custom station on edit', async () => {
    mocks.executeTakeFirst.mockResolvedValue({
      ...form,
      id: 4,
      code: 'custom-abc',
      type: 'station',
      custom: true,
      uic: null,
      viaggiatrenoId: null,
    });

    const result = await validateAndSaveStation({
      ...form,
      id: 4,
      name: 'Nuovo nome',
      uic: '8300001',
    });

    expect(result).toMatchObject({ success: true, message: 'Station updated' });
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        code: 'custom-abc',
        type: 'station',
        name: 'Nuovo nome',
        uic: '8300001',
      }),
    );
  });

  it('refuses to edit a synced station', async () => {
    mocks.executeTakeFirst.mockResolvedValue({
      ...form,
      id: 5,
      code: '8301700',
      type: 'main',
      custom: false,
      uic: '8301700',
      viaggiatrenoId: 'S01700',
    });

    const result = await validateAndSaveStation({ ...form, id: 5 });

    expect(result).toMatchObject({ success: false });
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('reports a station that does not exist', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);

    const result = await validateAndSaveStation({ ...form, id: 99 });

    expect(result).toMatchObject({
      success: false,
      message: 'Station not found',
    });
  });
});
