import { z } from 'zod';

export const journeyScopeSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('mine') }),
  z.object({ scope: z.literal('user'), userId: z.string().min(1) }),
  z.object({ scope: z.literal('all') }),
]);

export type JourneyScope = z.infer<typeof journeyScopeSchema>;
export type ResolvedJourneyScope = Exclude<JourneyScope, { scope: 'mine' }>;

export const DEFAULT_JOURNEY_SCOPE = {
  scope: 'mine',
} satisfies JourneyScope;

export const resolveJourneyScope = (
  scope: JourneyScope,
  actorUserId: string,
): ResolvedJourneyScope =>
  scope.scope === 'mine' ? { scope: 'user', userId: actorUserId } : scope;

export type JourneyScopeParseResult =
  | { success: true; data: JourneyScope }
  | { success: false; reason: 'invalid_scope' | 'missing_user' };

export const parseJourneyScopeSearchParams = (
  searchParams: URLSearchParams,
): JourneyScopeParseResult => {
  const scope = searchParams.get('scope') ?? 'mine';
  if (scope === 'mine' || scope === 'all') {
    return { success: true, data: { scope } };
  }
  if (scope !== 'user') {
    return { success: false, reason: 'invalid_scope' };
  }

  const userId = searchParams.get('userId');
  return userId
    ? { success: true, data: { scope, userId } }
    : { success: false, reason: 'missing_user' };
};
