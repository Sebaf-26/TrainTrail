import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';

import { seedJourney } from './journey';
import { seedUser } from './user';

export const seedDatabase = async (db: Kysely<DB>) => {
  const user = await seedUser(db);
  await seedJourney(db, user.id);
};
