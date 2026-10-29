export const platforms = [
  {
    name: 'TrainTrail',
    value: 'traintrail',
    description: 'JSON export from TrainTrail (re-import your data).',
    extensions: ['.json'],
    options: {
      filterOwner: false,
    },
  },
  {
    name: 'Ticket',
    value: 'ticket',
    description:
      'A journey read from a ticket: the message or e-mail (.eml) of your operator, a PDF ticket, an Apple Wallet pass (.pkpass) or a Google Wallet link.',
    extensions: ['.eml', '.pkpass', '.pdf', '.txt'],
    options: {
      filterOwner: false,
    },
  },
] as const;

export type Platform = (typeof platforms)[number];
export type PlatformValue = Platform['value'];
