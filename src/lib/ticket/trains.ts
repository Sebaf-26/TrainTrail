/** The category codes printed in front of a train number, e.g. FR 9605. */
export const TRAIN_CODES: Record<string, string> = {
  FR: 'Frecciarossa',
  FA: 'Frecciargento',
  FB: 'Frecciabianca',
  ICN: 'Intercity Notte',
  IC: 'Intercity',
  EC: 'Eurocity',
  EN: 'Euronight',
  RV: 'Regionale Veloce',
  REG: 'Regionale',
  ITA: 'Italo',
  RJX: 'Railjet Xpress',
  RJ: 'Railjet',
  NJ: 'Nightjet',
};

export const CODE_BY_TRAIN_NAME = new Map(
  Object.entries(TRAIN_CODES).map(([code, name]) => [name.toLowerCase(), code]),
);

/**
 * A train as printed on a ticket, a category and a number ("Regionale Veloce
 * 2129"), as the label the app uses ("RV 2129"). A category the app does not
 * know stays as printed, and a train without a number has no number.
 */
/** "InterCityNotte", "Intercity Notte" and "intercity notte" are one category. */
const squash = (name: string) => name.replace(/\s+/g, '').toLowerCase();

const CODE_BY_SQUASHED_NAME = new Map(
  [...CODE_BY_TRAIN_NAME].map(([name, code]) => [squash(name), code]),
);

/**
 * A train as printed on a ticket, a category and a number ("Regionale Veloce
 * 2129"), as the label the app uses ("RV 2129"). A short category the app does
 * not know ("sfm") is its own code; a longer one stays as printed, and a train
 * without a number has no number.
 */
export const describeTrain = (printed: string) => {
  const match = /^(.*?)\s*(\d{1,5})?$/.exec(printed.trim());
  const category = match?.[1]?.trim() ?? '';
  const number = match?.[2] ?? null;
  const code =
    CODE_BY_SQUASHED_NAME.get(squash(category)) ??
    (/^[A-Za-z]{2,4}$/.test(category) ? category.toUpperCase() : undefined);

  return {
    name: category || null,
    number: number ? (code ? `${code} ${number}` : number) : null,
  };
};
