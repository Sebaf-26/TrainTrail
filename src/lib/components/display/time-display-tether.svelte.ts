import { Tooltip } from 'bits-ui';

export type TimeDisplayMode = 'journey' | 'plain';

export type TimeDisplaySide = 'top' | 'right' | 'bottom' | 'left';

export type TimeDisplayPayload = {
  date: Date;
  stationTz: string | null;
  stationLabel: string | null;
  mode: TimeDisplayMode;
  side: TimeDisplaySide;
  zIndex: number | undefined;
};

export const timeDisplayTether = Tooltip.createTether<TimeDisplayPayload>();
