const ENGLISH_SMART_PUNCTUATION_REPLACEMENTS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u201f": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u00a0": " ",
  // Full-width/CJK punctuation is sometimes introduced when English
  // passages are copied from office documents or IMEs. Keep this mapping
  // scoped to the English bulk action; CJK punctuation in mixed passages is
  // kept intact.
  "\u3001": ",",
  "\u3002": ".",
  "\uff0c": ",",
  "\uff01": "!",
  "\uff1f": "?",
  "\uff1a": ":",
  "\uff1b": ";",
  "\uff08": "(",
  "\uff09": ")",
  "\uff3b": "[",
  "\uff3d": "]",
  "\u3010": "[",
  "\u3011": "]",
  "\u300c": '"',
  "\u300d": '"',
  "\u300e": '"',
  "\u300f": '"',
  "\u3014": "[",
  "\u3015": "]",
  "\uff02": '"',
  "\uff07": "'",
  "\uff05": "%",
  "\uff06": "&",
  "\uff0b": "+",
  "\uff1d": "=",
  "\uff0f": "/",
  "\uff3c": "\\"
};

// Only typographic variants that are unambiguous keyboard substitutes should
// be accepted during a session. Full-width/CJK punctuation is intentionally
// excluded here so Chinese practice still distinguishes `，` from `,`.
const ENGLISH_TYPING_EQUIVALENTS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u201f": '"',
  "\u2013": "-",
  "\u2014": "-"
};

const ENGLISH_SMART_PUNCTUATION_PATTERN = /[\u00a0\u2013\u2014\u2018-\u201f\u2026\u3001\u3002\uff01\uff02\uff05\uff06\uff07\uff0b\uff0c\uff0f\uff1a\uff1b\uff1d\uff1f\uff08\uff09\uff3b\uff3c\uff3d\u300c-\u300f\u3014\u3015\u3010\u3011]/g;

export type PassageTextNormalizationResult = {
  text: string;
  replacements: number;
};

export function normalizeEnglishPassagePunctuation(value: string): PassageTextNormalizationResult {
  let replacements = 0;
  // A mixed-language upload is safer left alone: an English passage may
  // legitimately quote Chinese text, while a Chinese passage should never
  // be changed by this action. Full-width punctuation in a Latin-only
  // passage is the case this bulk edit is intended to fix.
  const containsHanCharacters = /[\u3400-\u9fff\uf900-\ufaff]/.test(value);
  const text = value.replace(ENGLISH_SMART_PUNCTUATION_PATTERN, (character) => {
    if (containsHanCharacters && /[\u3001\u3002\u300c-\u300f\u3014\u3015\u3010\u3011\uff01\uff08\uff09\uff0c\uff1a\uff1b\uff1f\uff3b\uff3d]/.test(character)) {
      return character;
    }
    replacements += 1;
    return ENGLISH_SMART_PUNCTUATION_REPLACEMENTS[character] ?? character;
  });

  return { text, replacements };
}

export function normalizeEquivalentTypingPunctuation(character: string): string {
  const replacement = ENGLISH_TYPING_EQUIVALENTS[character];
  return replacement?.length === 1 ? replacement : character;
}
