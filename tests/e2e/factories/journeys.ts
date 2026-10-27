import { db } from '@test/db';
import type { Insertable } from 'kysely';

import type { DB } from '$lib/db/schema';

export interface JourneyInput {
  date: string;
  fromId: number;
  toId: number;
  departure?: string | null;
  arrival?: string | null;
  departurePlatform?: string | null;
  arrivalPlatform?: string | null;
  duration?: number | null;
  trainNumber?: string | null;
  unitNumber?: string | null;
  note?: string | null;
  trainId?: number | null;
  operatorId?: number | null;
}

type PassengerInput = Pick<
  Insertable<DB['journeyPassenger']>,
  'seat' | 'coach' | 'seatNumber' | 'seatClass' | 'journeyReason'
>;

export interface JourneyWithPassenger extends JourneyInput {
  userId: string;
  passenger?: PassengerInput;
}

export const journeysFactory = {
  async create(
    input: JourneyWithPassenger,
  ): Promise<{ journey: { id: number } }> {
    // Insert journey
    const journeyResult = await db
      .insertInto('journey')
      .values({
        date: input.date,
        fromId: input.fromId,
        toId: input.toId,
        departure: input.departure ?? null,
        arrival: input.arrival ?? null,
        departurePlatform: input.departurePlatform ?? null,
        arrivalPlatform: input.arrivalPlatform ?? null,
        duration: input.duration ?? null,
        trainNumber: input.trainNumber ?? null,
        unitNumber: input.unitNumber ?? null,
        note: input.note ?? null,
        trainId: input.trainId ?? null,
        operatorId: input.operatorId ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Insert the user's passenger record for the journey
    await db
      .insertInto('journeyPassenger')
      .values({
        journeyId: journeyResult.id,
        userId: input.userId,
        seat: input.passenger?.seat ?? null,
        coach: input.passenger?.coach ?? null,
        seatNumber: input.passenger?.seatNumber ?? null,
        seatClass: input.passenger?.seatClass ?? null,
        journeyReason: input.passenger?.journeyReason ?? null,
        guestName: null,
      })
      .execute();

    return { journey: { id: journeyResult.id } };
  },
};
