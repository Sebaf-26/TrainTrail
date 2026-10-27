import { trpc } from './index';

export const invalidateJourneyData = async () => {
  await Promise.all([
    trpc.journey.list.utils.invalidate(),
    trpc.journey.guests.utils.invalidate(),
    trpc.journeyTrack.list.utils.invalidate(),
  ]);
};
