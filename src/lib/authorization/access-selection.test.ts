import { describe, expect, it } from 'vitest';

import { groupAccessItems, type AccessRow } from './access-presentation';
import { createAccessSelection } from './access-selection';
import { impliedPermission, type Permission } from './permissions';

const rowFor = <K extends string>(rows: AccessRow<K>[], key: string) => {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) throw new Error(`missing row ${key}`);
  return row;
};

const actionOf = <K extends string>(
  row: AccessRow<K>,
  kind: 'read' | 'write',
) => {
  const action = row.actions.find((candidate) => candidate.action === kind);
  if (!action) throw new Error(`missing ${kind} action on ${row.key}`);
  return action;
};

const sorted = <K extends string>(keys: readonly K[]) => [...keys].sort();

describe('scope selection', () => {
  const rows = groupAccessItems(
    ['tracks.read', 'tracks.write', 'stats.read'],
    (scope) => scope,
  );
  const selection = createAccessSelection<string, string>({
    key: (scope) => scope,
    describe: (scope) => scope,
  });
  const tracks = rowFor(rows, 'tracks');

  it('selects and clears a read action', () => {
    const read = actionOf(tracks, 'read');
    const selected = selection.toggle([], tracks, read);
    expect(selected).toEqual(['tracks.read']);
    expect(selection.toggle(selected, tracks, read)).toEqual([]);
  });

  it('adds the read when write is selected', () => {
    expect(
      sorted(selection.toggle([], tracks, actionOf(tracks, 'write'))),
    ).toEqual(['tracks.read', 'tracks.write']);
  });

  it('keeps the read when write is cleared', () => {
    expect(
      selection.toggle(
        ['tracks.read', 'tracks.write'],
        tracks,
        actionOf(tracks, 'write'),
      ),
    ).toEqual(['tracks.read']);
  });

  it('locks the read while write is held', () => {
    const selected = ['tracks.read', 'tracks.write'];
    const read = actionOf(tracks, 'read');
    expect(selection.readLockedByWrite(selected, tracks, read)).toBe(true);
    expect(selection.actionInherited(selected, tracks, read)).toBe(true);
    expect(sorted(selection.toggle(selected, tracks, read))).toEqual(
      sorted(selected),
    );
    expect(selection.actionTitle(selected, tracks, read)).toBe(
      'Included by Write access. tracks.read',
    );
  });

  it('describes an unlocked action by its items', () => {
    const read = actionOf(tracks, 'read');
    expect(selection.actionInherited([], tracks, read)).toBe(false);
    expect(selection.actionTitle([], tracks, read)).toBe('tracks.read');
  });
});

describe('permission selection', () => {
  const permissions: Permission[] = [
    'journey.read.own',
    'journey.export.own',
    'journey.create.own',
    'journey.read.any',
    'journey.export.any',
    'journey.create.any',
  ];
  const rows = groupAccessItems(permissions, (permission) => permission);
  const own = rowFor(rows, 'journey.own');
  const any = rowFor(rows, 'journey.any');
  const selection = createAccessSelection<Permission, Permission>({
    key: (permission) => permission,
    describe: (permission) => permission,
    broader: impliedPermission,
  });

  it('treats narrower permissions as inherited from broader ones', () => {
    const selected: Permission[] = ['journey.read.any', 'journey.export.any'];
    const read = actionOf(own, 'read');
    expect(selection.actionChecked(selected, read)).toBe(true);
    expect(selection.actionInherited(selected, own, read)).toBe(true);
    expect(selection.actionTitle(selected, own, read)).toBe(
      'Included by All journeys. journey.read.own · journey.export.own',
    );
  });

  it('marks partially held actions as indeterminate', () => {
    const read = actionOf(own, 'read');
    expect(selection.actionIndeterminate(['journey.read.own'], read)).toBe(
      true,
    );
    expect(selection.actionChecked(['journey.read.own'], read)).toBe(false);
  });

  it('drops narrower grants once the broader one is selected', () => {
    expect(
      sorted(
        selection.toggle(
          ['journey.read.own', 'journey.export.own'],
          any,
          actionOf(any, 'read'),
        ),
      ),
    ).toEqual(['journey.export.any', 'journey.read.any']);
  });

  it('does not grant implied items when toggling', () => {
    expect(
      sorted(
        selection.toggle(['journey.read.any'], own, actionOf(own, 'read')),
      ),
    ).toEqual(['journey.export.own', 'journey.read.any']);
  });

  it('restores the reads a held write needs after clearing the broader read', () => {
    const cleared = selection.toggle(
      ['journey.create.own', 'journey.read.any', 'journey.export.any'],
      any,
      actionOf(any, 'read'),
    );
    expect(sorted(selection.withReadForWrite(cleared, rows))).toEqual([
      'journey.create.own',
      'journey.export.own',
      'journey.read.own',
    ]);
  });

  it('adds reads for held writes across rows', () => {
    expect(
      sorted(selection.withReadForWrite(['journey.create.own'], rows)),
    ).toEqual(['journey.create.own', 'journey.export.own', 'journey.read.own']);
  });

  it('only picks selectable items', () => {
    const limited = createAccessSelection<Permission, Permission>({
      key: (permission) => permission,
      describe: (permission) => permission,
      selectable: (action) =>
        action.items.filter(
          (permission) => permission !== 'journey.export.own',
        ),
      broader: impliedPermission,
    });
    expect(limited.toggle([], own, actionOf(own, 'read'))).toEqual([
      'journey.read.own',
    ]);
  });
});
