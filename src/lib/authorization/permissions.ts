import type { AccessPlacement } from './access-presentation';

const PERMISSION_GROUPS_DEFINITION = [
  { key: 'journeys', label: 'Journeys' },
  { key: 'users', label: 'Users' },
  { key: 'configuration', label: 'Data and configuration' },
  { key: 'security', label: 'Security and tools' },
] as const;

type PermissionGroupKey = (typeof PERMISSION_GROUPS_DEFINITION)[number]['key'];

type PermissionDefinition = {
  key: string;
  group: PermissionGroupKey;
  access: AccessPlacement;
  description: string;
};

export const PERMISSION_CATALOG = [
  {
    key: 'journey.read.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'read' },
    description: 'View journeys where the user is a passenger.',
  },
  {
    key: 'journey.read.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'read' },
    description: "View every user's journeys, tracks, and statistics.",
  },
  {
    key: 'journey.create.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Create journeys that include the user as a passenger.',
  },
  {
    key: 'journey.create.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'write' },
    description: 'Create journeys without being a passenger.',
  },
  {
    key: 'journey.update.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Edit journeys where the user is a passenger.',
  },
  {
    key: 'journey.update.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'write' },
    description: "Edit any user's journey.",
  },
  {
    key: 'journey.delete.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Delete journeys where the user is a passenger.',
  },
  {
    key: 'journey.delete.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'write' },
    description: "Delete any user's journey.",
  },
  {
    key: 'journey.import.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Import personal journey data.',
  },
  {
    key: 'journey.import.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'write' },
    description: 'Import data for any user.',
  },
  {
    key: 'journey.export.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'read' },
    description: 'Export personal journey data.',
  },
  {
    key: 'journey.export.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'read' },
    description: "Export any user's or all users' journey data.",
  },
  {
    key: 'journey.passengers.manage.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Add, edit, or remove passengers on participating journeys.',
  },
  {
    key: 'journey.passengers.manage.any',
    group: 'journeys',
    access: { row: 'journey.any', action: 'write' },
    description: 'Add, edit, or remove passengers on any journey.',
  },
  {
    key: 'journey.share.own',
    group: 'journeys',
    access: { row: 'journey.own', action: 'write' },
    description: 'Publish personal journey data through public share links.',
  },
  {
    key: 'users.directory.read',
    group: 'users',
    access: { row: 'users', action: 'read' },
    description: 'See users in selectors and settings.',
  },
  {
    key: 'users.create',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Create local user accounts.',
  },
  {
    key: 'users.update',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Edit users with fewer permissions.',
  },
  {
    key: 'users.delete',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Delete users with fewer permissions.',
  },
  {
    key: 'users.roles.assign',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Assign roles that do not exceed the actor’s permissions.',
  },
  {
    key: 'data.stations.manage',
    group: 'configuration',
    access: { row: 'stations', action: 'write' },
    description: 'Create, edit, delete, and synchronize stations.',
  },
  {
    key: 'data.trains.manage',
    group: 'configuration',
    access: { row: 'train', action: 'write' },
    description: 'Create, edit, delete, and synchronize train models.',
  },
  {
    key: 'data.operators.manage',
    group: 'configuration',
    access: { row: 'operators', action: 'write' },
    description:
      'Create, edit, delete, and synchronize operators, and manage their icons.',
  },
  {
    key: 'custom_fields.manage',
    group: 'configuration',
    access: { row: 'custom_fields', action: 'write' },
    description: 'Create and change custom-field definitions.',
  },
  {
    key: 'instance.oauth.manage',
    group: 'configuration',
    access: { row: 'instance', action: 'write' },
    description: 'Configure OAuth and role mappings.',
  },
  {
    key: 'instance.map.manage',
    group: 'configuration',
    access: { row: 'instance', action: 'write' },
    description: 'Configure instance-wide map styles.',
  },
  {
    key: 'instance.release.check',
    group: 'configuration',
    access: { row: 'instance', action: 'read' },
    description: 'Check for and display newer TrainTrail releases.',
  },
  {
    key: 'roles.manage',
    group: 'security',
    access: { row: 'roles', action: 'write' },
    description:
      'Create and edit roles without granting unavailable permissions.',
  },
  {
    key: 'tools.sql.execute',
    group: 'security',
    access: { row: 'sql', action: 'write' },
    description: 'Run arbitrary SQL against the TrainTrail database.',
  },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSION_CATALOG)[number]['key'];

export const PERMISSIONS: Permission[] = PERMISSION_CATALOG.map(
  ({ key }) => key,
);

export type PermissionGroup = {
  label: string;
  permissions: Array<{ key: Permission; description: string }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] =
  PERMISSION_GROUPS_DEFINITION.map((group) => ({
    label: group.label,
    permissions: PERMISSION_CATALOG.filter(
      (permission) => permission.group === group.key,
    ).map(({ key, description }) => ({ key, description })),
  }));

const IMPLIED_PERMISSIONS: Partial<Record<Permission, Permission>> = {
  'journey.read.own': 'journey.read.any',
  'journey.create.own': 'journey.create.any',
  'journey.update.own': 'journey.update.any',
  'journey.delete.own': 'journey.delete.any',
  'journey.import.own': 'journey.import.any',
  'journey.export.own': 'journey.export.any',
  'journey.passengers.manage.own': 'journey.passengers.manage.any',
};

const permissionSet: ReadonlySet<string> = new Set(PERMISSIONS);

export const isPermission = (value: string): value is Permission =>
  permissionSet.has(value);

export const impliedPermission = (permission: Permission): Permission | null =>
  IMPLIED_PERMISSIONS[permission] ?? null;

/** Remove narrower grants that are already covered by a broader grant. */
export const normalizePermissions = (
  permissions: Iterable<Permission>,
): Permission[] => {
  const normalized = new Set(permissions);
  for (const permission of PERMISSIONS) {
    const broader = impliedPermission(permission);
    if (broader && normalized.has(broader)) normalized.delete(permission);
  }
  return [...normalized];
};

export type PermissionSubject = {
  readonly isOwner: boolean;
  readonly permissions: Iterable<Permission>;
};

const asPermissionSet = (permissions: Iterable<Permission>) =>
  permissions instanceof Set ? permissions : new Set(permissions);

const setHasPermission = (
  permissions: ReadonlySet<Permission>,
  permission: Permission,
) => {
  if (permissions.has(permission)) return true;
  const implied = impliedPermission(permission);
  return implied ? permissions.has(implied) : false;
};

export const hasPermission = (
  authorization: PermissionSubject | null,
  permission: Permission,
) => {
  if (!authorization) return false;
  if (authorization.isOwner) return true;
  return setHasPermission(
    asPermissionSet(authorization.permissions),
    permission,
  );
};

export const canCreateUserAccount = (authorization: PermissionSubject | null) =>
  hasPermission(authorization, 'users.create') &&
  hasPermission(authorization, 'users.roles.assign');

export const canRestoreAllJourneys = (
  authorization: PermissionSubject | null,
) =>
  hasPermission(authorization, 'journey.import.any') &&
  hasPermission(authorization, 'users.directory.read');

export const canDeduplicateOwnJourneys = (
  authorization: PermissionSubject | null,
) =>
  hasPermission(authorization, 'journey.read.own') &&
  hasPermission(authorization, 'journey.delete.own');

export const canSetDefaultRole = (authorization: PermissionSubject | null) =>
  hasPermission(authorization, 'roles.manage') &&
  hasPermission(authorization, 'users.roles.assign') &&
  hasPermission(authorization, 'instance.oauth.manage');

export const effectivePermissions = (permissions: Iterable<Permission>) => {
  const permissionSet = asPermissionSet(permissions);
  return new Set(
    PERMISSIONS.filter((permission) =>
      setHasPermission(permissionSet, permission),
    ),
  );
};

export const permissionsStrictlyInclude = (
  actorPermissions: Iterable<Permission>,
  targetPermissions: Iterable<Permission>,
) => {
  const actor = effectivePermissions(actorPermissions);
  const target = effectivePermissions(targetPermissions);
  return (
    actor.size > target.size &&
    [...target].every((permission) => actor.has(permission))
  );
};

export const hasClientPermission = hasPermission;
