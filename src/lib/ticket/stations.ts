// Abbreviations used on tickets and in the Trenitalia real-time system.
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bC\.\s?LE\.?(?=\s|\/|$)/gi, 'Centrale'],
  [
    /\bP\.\s?(NUOVA|GARIBALDI|VITTORIA|ROMANA|SUSA|VESCOVO|GENOVA|TICINESE)\b/gi,
    'Porta $1',
  ],
  [/\bP\.\s?PRINCIPE\b/gi, 'Piazza Principe'],
  [/\bS\.\s?M\.\s?N\.?(?=\s|$)/gi, 'Santa Maria Novella'],
  [/\bS\.\s?M\.\s?NOVELLA\b/gi, 'Santa Maria Novella'],
  [/\bS\.\s?LUCIA\b/gi, 'Santa Lucia'],
  [/\bTIB\.?(?=\s|$)/gi, 'Tiburtina'],
  // ÖBB prints upper-case names, with abbreviations of its own.
  [/\bC\.\s?MARTE\b/gi, 'Campo di Marte'],
  [/\bHBF\b/gi, 'Hbf'],
  [/\bHAUPTBAHNHOF\b/gi, 'Hbf'],
];

const collapse = (name: string) => name.replace(/\s{2,}/g, ' ').trim();

/**
 * The names under which a station printed on a ticket may be stored: as
 * printed, with the usual abbreviations expanded, and without a trailing
 * qualifier in brackets.
 */
export const stationNameVariants = (name: string): string[] => {
  const printed = collapse(name);
  const expanded = collapse(
    ABBREVIATIONS.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      printed,
    ),
  );
  const withoutQualifier = collapse(expanded.replace(/\s*\([^)]*\)\s*$/, ''));

  return [...new Set([printed, expanded, withoutQualifier])].filter(Boolean);
};
