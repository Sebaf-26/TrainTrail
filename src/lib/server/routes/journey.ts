import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, permissionProcedure, router } from '../trpc';

import { db } from '$lib/db';
import {
  deleteJourneyTicketPrimitive,
  getJourneyTicketPrimitive,
} from '$lib/db/queries';
import type { CreateJourney } from '$lib/db/types';
import {
  DEFAULT_JOURNEY_SCOPE,
  journeyScopeSchema,
  resolveJourneyScope,
} from '$lib/journey-scope';
import {
  createJourney,
  createManyJourneys,
  deleteJourney,
  listJourneys,
  listJourneysInScope,
  listGuestNames,
  validateJourneyDates,
} from '$lib/server/utils/journey';
import { validateJourneyImportPermissions } from '$lib/server/utils/journey-import';
import { generateCsv } from '$lib/utils/csv';
import { generateBackup, serializeBackup } from '$lib/server/utils/backup';
import { hasPermission } from '$lib/server/authorization/authorize';
import {
  canAccessJourney,
  canAccessJourneys,
  canCreateJourney,
  canExportJourneys,
  canListJourneys,
} from '$lib/server/authorization/journey';

export const journeyRouter = router({
  list: authedProcedure
    .input(journeyScopeSchema.optional().default(DEFAULT_JOURNEY_SCOPE))
    .query(async ({ ctx: { user, authorization }, input }) => {
      if (!canListJourneys(authorization, input)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return await listJourneysInScope(resolveJourneyScope(input, user.id));
    }),
  // The barcode of a ticket is a credential: it is only ever given back to the
  // user it was kept for, and never travels with lists, exports or shares.
  ticket: authedProcedure
    .input(z.number())
    .query(async ({ ctx: { user }, input }) => {
      return await getJourneyTicketPrimitive(db, input, user.id);
    }),
  removeTicket: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      return await deleteJourneyTicketPrimitive(db, input, user.id);
    }),
  guests: permissionProcedure('journey.read.own').query(
    async ({ ctx: { user } }) => {
      return await listGuestNames(user.id);
    },
  ),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessJourney(authorization, 'delete', input))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const resp = await deleteJourney(input);

      if (!resp.numDeletedRows) {
        throw new Error('Journey not found');
      }
    }),
  deleteMany: authedProcedure
    .input(z.array(z.number()))
    .mutation(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessJourneys(authorization, 'delete', input))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await db.deleteFrom('journey').where('id', 'in', input).execute();
    }),
  deleteAll: authedProcedure.mutation(
    async ({ ctx: { user, authorization } }) => {
      if (!hasPermission(authorization, 'journey.delete.own')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const journeyIds = await db
        .selectFrom('journey')
        .innerJoin(
          'journeyPassenger',
          'journeyPassenger.journeyId',
          'journey.id',
        )
        .select('journey.id')
        .groupBy('journey.id')
        .having((eb) =>
          eb.and([
            eb(
              eb.fn.count(
                eb
                  .case()
                  .when('journeyPassenger.userId', '=', user.id)
                  .then(1)
                  .else(null)
                  .end(),
              ),
              '=',
              1,
            ),
            eb(
              eb.fn.count(
                eb
                  .case()
                  .when('journeyPassenger.userId', 'is', null)
                  .then(1)
                  .else(null)
                  .end(),
              ),
              '=',
              eb(eb.fn.count('journeyPassenger.id'), '-', eb.lit(1)),
            ),
          ]),
        )
        .execute();

      if (journeyIds.length === 0) {
        return;
      }

      const idsToDelete = journeyIds.map((f) => f.id);
      await db.deleteFrom('journey').where('id', 'in', idsToDelete).execute();
    },
  ),
  create: authedProcedure
    .input(z.custom<CreateJourney>())
    .mutation(async ({ ctx: { authorization }, input }) => {
      if (!canCreateJourney(authorization, input.passengers)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const dateError = validateJourneyDates(input);
      if (dateError) {
        throw new Error(dateError);
      }
      await createJourney(input);
    }),
  createMany: authedProcedure
    .input(
      z.object({
        journeys: z.custom<CreateJourney[]>(),
        dedupe: z.boolean().optional(),
        mode: z.enum(['personal', 'restore']).default('personal'),
      }),
    )
    .mutation(async ({ ctx: { user, authorization }, input }) => {
      for (const journey of input.journeys) {
        const dateError = validateJourneyDates(journey);
        if (dateError) {
          throw new Error(dateError);
        }
      }
      const permissionError = validateJourneyImportPermissions(
        authorization,
        input.journeys,
        input.mode,
      );
      if (permissionError) {
        throw new TRPCError({ code: 'FORBIDDEN', message: permissionError });
      }

      return await createManyJourneys(
        input.journeys,
        user.id,
        input.dedupe ?? true,
        input.mode,
      );
    }),
  exportJson: authedProcedure.query(
    async ({ ctx: { user, authorization } }) => {
      // The personal export intentionally remains separate from general read.
      // It is a bulk data operation.
      if (!canExportJourneys(authorization, DEFAULT_JOURNEY_SCOPE)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const backup = await generateBackup(
        resolveJourneyScope(DEFAULT_JOURNEY_SCOPE, user.id),
      );
      return serializeBackup(backup, 'json');
    },
  ),
  exportCsv: authedProcedure.query(async ({ ctx: { user, authorization } }) => {
    if (!canExportJourneys(authorization, DEFAULT_JOURNEY_SCOPE)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    const res = await listJourneys(user.id);
    const journeys = res.map(({ id: _, passengers, ...journey }) => {
      const passenger = passengers.find(
        (passenger) => passenger.userId === user.id,
      );

      return {
        ...journey,
        from: journey.from?.name,
        to: journey.to?.name,
        operator: journey.operator?.name,
        train: journey.train?.name,
        seat: passenger?.seat,
        coach: passenger?.coach,
        seatNumber: passenger?.seatNumber,
        seatClass: passenger?.seatClass,
        journeyReason: passenger?.journeyReason,
      };
    });

    return generateCsv(journeys);
  }),
});
