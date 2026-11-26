/**
 * Spoken numbers, both ways: reading a number from written words ("two point five trillion",
 * "2,500,000", "minus forty") and writing a value as the words a narrator says. Pure; shared by
 * the script↔audio alignment (timing.ts), the editorial rules (beat-sheet.ts) and the unit
 * formatter (format.ts), so the voice, the validator and the screen read numbers one way.
 */

/** Normalised tokens: lowercase words/numbers, punctuation dropped ("Rome's" → "romes"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Value of each English number word. */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
/** Scale words, largest first (numberWords writes them in this order). */
const MULTIPLIERS: Record<string, number> = { trillion: 1e12, billion: 1e9, million: 1e6, thousand: 1e3, hundred: 100 };
/** Words that make the number after them negative ("minus forty", "negative five"). */
const SIGN_WORDS: ReadonlySet<string> = new Set(['minus', 'negative']);

/**
 * Grammar of a number, as data: which token class may follow which. Extend number reading by
 * adding a class or a row here, not a branch in `readNumber`. `group` is a 3-digit run after
 * digits in the same written word ("1,000" → 1 000); `fraction` is a digit after "point" or after
 * digits in the same word ("5.5" → 5 5), and may take a scale ("two point five trillion"). "a"
 * counts as one only before a multiplier ("a hundred").
 */
type NumClass = 'ones' | 'teen' | 'tens' | 'hundred' | 'scale' | 'digits' | 'group' | 'fraction' | 'a' | 'and' | 'point' | 'minus';
const NUMBER_FOLLOWS: Record<NumClass | 'start', readonly NumClass[]> = {
  start: ['ones', 'teen', 'tens', 'digits', 'a', 'minus'],
  minus: ['ones', 'teen', 'tens', 'digits'],
  a: ['hundred', 'scale'],
  ones: ['hundred', 'scale', 'point'],
  teen: ['hundred', 'scale', 'point'],
  tens: ['ones', 'scale', 'point'],
  hundred: ['ones', 'teen', 'tens', 'scale', 'and'],
  scale: ['ones', 'teen', 'tens', 'and'],
  and: ['ones', 'teen', 'tens'],
  digits: ['hundred', 'scale', 'group', 'fraction', 'point'],
  group: ['group', 'scale', 'fraction'],
  point: ['fraction'],
  fraction: ['fraction', 'scale'],
};
/** Classes a number may end on (never "a", "and", "point" or a bare "minus"). */
const NUMBER_ENDS: ReadonlySet<NumClass> = new Set(['ones', 'teen', 'tens', 'hundred', 'scale', 'digits', 'group', 'fraction']);
/** Classes of a plain one/two-digit word number: the halves of a year read in pairs ("fourteen fifty-three"). */
const PAIR_WORDS: ReadonlySet<NumClass> = new Set(['ones', 'teen', 'tens']);

type AlignToken = { t: string; joined: boolean };

/** A token's class given the class before it; `joined` = same written word as that token. */
function numClass({ t, joined }: AlignToken, prev: NumClass | 'start'): NumClass | null {
  const afterPoint = prev === 'point' || prev === 'fraction';
  if (/^\d+$/.test(t)) {
    if (afterPoint) return 'fraction';
    if (!joined || (prev !== 'digits' && prev !== 'group')) return 'digits';
    return t.length === 3 ? 'group' : 'fraction';
  }
  const v = NUMBER_WORDS[t];
  if (v !== undefined) return afterPoint ? (v < 10 ? 'fraction' : null) : v < 10 ? 'ones' : v < 20 ? 'teen' : 'tens';
  if (t === 'hundred') return 'hundred';
  if (t in MULTIPLIERS) return 'scale';
  if (SIGN_WORDS.has(t)) return 'minus';
  return t === 'a' || t === 'and' || t === 'point' ? t : null;
}

type NumberRun = { end: number; value: number; pair: boolean };
/** The running number: done scales, the current group, fraction digits as written ("05" in 3.05), sign. */
type Tally = { total: number; current: number; frac: string; sign: 1 | -1 };

/** current.frac as a number, times 10^exp, computed in decimal so 1.15 million is exactly 1150000. */
const decimal = (n: Tally, exp = 0) => Number(`${n.current}.${n.frac || '0'}e${exp}`);

/** How each class folds its token into the running number (value `v`, written token `t`). */
const TALLY: Record<NumClass, (n: Tally, v: number, t: string) => Tally> = {
  ones: (n, v) => ({ ...n, current: n.current + v }),
  teen: (n, v) => ({ ...n, current: n.current + v }),
  tens: (n, v) => ({ ...n, current: n.current + v }),
  digits: (n, v) => ({ ...n, current: n.current + v }),
  a: (n) => ({ ...n, current: 1 }),
  hundred: (n) => ({ ...n, current: n.current * 100 }),
  scale: (n, v) => ({ ...n, total: n.total + decimal(n, Math.log10(v)), current: 0, frac: '' }),
  group: (n, v) => ({ ...n, current: n.current * 1000 + v }),
  fraction: (n, v, t) => ({ ...n, frac: n.frac + (NUMBER_WORDS[t] === undefined ? t : String(v)) }),
  and: (n) => n,
  point: (n) => n,
  minus: (n) => ({ ...n, sign: -1 }),
};

/** Longest number starting at `toks[i]` under NUMBER_FOLLOWS, or null. */
function readNumber(toks: readonly AlignToken[], i: number): NumberRun | null {
  let prev: NumClass | 'start' = 'start';
  let tally: Tally = { total: 0, current: 0, frac: '', sign: 1 };
  let pair = true;
  let best: NumberRun | null = null;
  for (let k = i; k < toks.length; k++) {
    const cls = numClass(toks[k]!, prev);
    if (!cls || !NUMBER_FOLLOWS[prev].includes(cls)) break;
    const t = toks[k]!.t;
    tally = TALLY[cls](tally, NUMBER_WORDS[t] ?? MULTIPLIERS[t] ?? Number(t), t);
    pair &&= PAIR_WORDS.has(cls);
    prev = cls;
    if (NUMBER_ENDS.has(cls)) best = { end: k + 1, value: tally.sign * (tally.total + decimal(tally)), pair };
  }
  return best;
}

/** British → American spellings folded for matching ("kilometres" = "kilometers"); stems are long enough to spare four/hour/your/rise. */
const SPELLING: readonly [RegExp, string][] = [
  [/^(\w{4,})is(e|ed|es|ing|ation|ations)$/, '$1iz$2'],
  [/^(\w{2,})tre(s|d)?$/, '$1ter$2'],
  [/^(\w{3,})our(s|ed|ing|ite|ites)?$/, '$1or$2'],
];

/** One unit of speech over a word list's tokens [from, to): a number carries its `value`. */
export type SpeechUnit = { key: string; from: number; to: number; value?: number };

/**
 * Speech units of written words: a number ("nine hundred seventy-seven", "977", "5 million",
 * "1,000", "5.5", "two point five trillion", "minus forty") is ONE unit keyed by its value, so
 * spelled and digit forms match; a year read in pairs ("fourteen fifty-three") keys as 1453. Other
 * tokens key by folded spelling. Token indexes count `words.flatMap(tokenize)`.
 * Unsupported: "oh" years ("nineteen oh five"), ordinals, "half"/"quarter".
 */
export function speechUnits(words: readonly string[]): SpeechUnit[] {
  const toks = words.flatMap((w) => tokenize(w).map((t, k) => ({ t, joined: k > 0 })));
  const units: SpeechUnit[] = [];
  for (let i = 0; i < toks.length; ) {
    const head = readNumber(toks, i);
    const tail = head?.pair && head.value >= 11 ? readNumber(toks, head.end) : null;
    const num = tail?.pair && tail.value >= 10 ? { end: tail.end, value: head!.value * 100 + tail.value } : head;
    const end = num?.end ?? i + 1;
    units.push(num ? { key: `#${num.value}`, from: i, to: end, value: num.value } : { key: SPELLING.reduce((t, [re, to]) => t.replace(re, to), toks[i]!.t), from: i, to: end });
    i = end;
  }
  return units;
}

const WORD_OF = Object.fromEntries(Object.entries(NUMBER_WORDS).map(([w, v]) => [v, w])) as Record<number, string>;
const under100 = (n: number) => WORD_OF[n] ?? `${WORD_OF[n - (n % 10)]}-${WORD_OF[n % 10]}`;
const under1000 = (n: number) => [...(n >= 100 ? [`${WORD_OF[Math.floor(n / 100)]} hundred`] : []), ...(n % 100 || n < 100 ? [under100(n % 100)] : [])].join(' ');

/**
 * The words a narrator says for `n` with `decimals` fraction digits, the inverse of speechUnits:
 * 2.5 → "two point five", 1453 → "one thousand four hundred fifty-three", -40 → "minus forty".
 */
export function numberWords(n: number, decimals = 0): string {
  const [int, frac = ''] = Math.abs(n).toFixed(decimals).split('.');
  let rest = Number(int);
  const groups = Object.entries(MULTIPLIERS)
    .filter(([w]) => w !== 'hundred')
    .flatMap(([w, v]) => {
      const k = Math.floor(rest / v);
      rest %= v;
      return k ? [`${under1000(k)} ${w}`] : [];
    });
  const whole = [...groups, ...(rest || groups.length === 0 ? [under1000(rest)] : [])].join(' ');
  const point = frac.replace(/0+$/, '');
  return [n < 0 ? 'minus' : '', whole, point && `point ${[...point].map((d) => WORD_OF[Number(d)]).join(' ')}`].filter(Boolean).join(' ');
}
