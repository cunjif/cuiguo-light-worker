// src/utils/docx-math/latex-dict.ts
// Ported from Python: markitdown/converter_utils/docx/math/latex_dict.py
// Adapted from https://github.com/xiilei/dwml/blob/master/dwml/latex_dict.py

/**
 * Characters that need escaping in LaTeX.
 */
export const CHARS: ReadonlySet<string> = new Set([
  '{',
  '}',
  '_',
  '^',
  '#',
  '&',
  '$',
  '%',
  '~',
]);

export const BLANK = '';
export const BACKSLASH = '\\';
export const ALN = '&';
export const BRK = '\\\\';
export const FUNC_PLACE = '{fe}';

/**
 * Unicode char -> LaTeX accent/grouping command.
 * Values use `{0}` as a placeholder for the accented content.
 */
export const CHR: Record<string, string> = {
  // Top accents
  '\u0300': '\\grave{{{0}}}',
  '\u0301': '\\acute{{{0}}}',
  '\u0302': '\\hat{{{0}}}',
  '\u0303': '\\tilde{{{0}}}',
  '\u0304': '\\bar{{{0}}}',
  '\u0305': '\\overbar{{{0}}}',
  '\u0306': '\\breve{{{0}}}',
  '\u0307': '\\dot{{{0}}}',
  '\u0308': '\\ddot{{{0}}}',
  '\u0309': '\\ovhook{{{0}}}',
  '\u030a': '\\ocirc{{{0}}}}',
  '\u030c': '\\check{{{0}}}}',
  '\u0310': '\\candra{{{0}}}',
  '\u0312': '\\oturnedcomma{{{0}}}',
  '\u0315': '\\ocommatopright{{{0}}}',
  '\u031a': '\\droang{{{0}}}',
  '\u0338': '\\not{{{0}}}',
  '\u20d0': '\\leftharpoonaccent{{{0}}}',
  '\u20d1': '\\rightharpoonaccent{{{0}}}',
  '\u20d2': '\\vertoverlay{{{0}}}',
  '\u20d6': '\\overleftarrow{{{0}}}',
  '\u20d7': '\\vec{{{0}}}',
  '\u20db': '\\dddot{{{0}}}',
  '\u20dc': '\\ddddot{{{0}}}',
  '\u20e1': '\\overleftrightarrow{{{0}}}',
  '\u20e7': '\\annuity{{{0}}}',
  '\u20e9': '\\widebridgeabove{{{0}}}',
  '\u20f0': '\\asteraccent{{{0}}}',
  // Bottom accents
  '\u0330': '\\wideutilde{{{0}}}',
  '\u0331': '\\underbar{{{0}}}',
  '\u20e8': '\\threeunderdot{{{0}}}',
  '\u20ec': '\\underrightharpoondown{{{0}}}',
  '\u20ed': '\\underleftharpoondown{{{0}}}',
  '\u20ee': '\\underledtarrow{{{0}}}',
  '\u20ef': '\\underrightarrow{{{0}}}',
  // Over | group
  '\u23b4': '\\overbracket{{{0}}}',
  '\u23dc': '\\overparen{{{0}}}',
  '\u23de': '\\overbrace{{{0}}}',
  // Under | group
  '\u23b5': '\\underbracket{{{0}}}',
  '\u23dd': '\\underparen{{{0}}}',
  '\u23df': '\\underbrace{{{0}}}',
};

/**
 * Big operators: Unicode char -> LaTeX command.
 */
export const CHR_BO: Record<string, string> = {
  '\u2140': '\\Bbbsum',
  '\u220f': '\\prod',
  '\u2210': '\\coprod',
  '\u2211': '\\sum',
  '\u222b': '\\int',
  '\u22c0': '\\bigwedge',
  '\u22c1': '\\bigvee',
  '\u22c2': '\\bigcap',
  '\u22c3': '\\bigcup',
  '\u2a00': '\\bigodot',
  '\u2a01': '\\bigoplus',
  '\u2a02': '\\bigotimes',
};

/**
 * Text/symbol translation table: Unicode char -> LaTeX representation.
 * Includes Greek letters, relation symbols, ordinary symbols, binary relations,
 * and italic Latin letters.
 */
export const T: Record<string, string> = {
  '\u2192': '\\rightarrow ',
  // Greek letters
  '\u{1d6fc}': '\\alpha ',
  '\u{1d6fd}': '\\beta ',
  '\u{1d6fe}': '\\gamma ',
  '\u{1d6ff}': '\\theta ',
  '\u{1d700}': '\\epsilon ',
  '\u{1d701}': '\\zeta ',
  '\u{1d702}': '\\eta ',
  '\u{1d703}': '\\theta ',
  '\u{1d704}': '\\iota ',
  '\u{1d705}': '\\kappa ',
  '\u{1d706}': '\\lambda ',
  '\u{1d707}': '\\m ',
  '\u{1d708}': '\\n ',
  '\u{1d709}': '\\xi ',
  '\u{1d70a}': '\\omicron ',
  '\u{1d70b}': '\\pi ',
  '\u{1d70c}': '\\rho ',
  '\u{1d70d}': '\\varsigma ',
  '\u{1d70e}': '\\sigma ',
  '\u{1d70f}': '\\ta ',
  '\u{1d710}': '\\upsilon ',
  '\u{1d711}': '\\phi ',
  '\u{1d712}': '\\chi ',
  '\u{1d713}': '\\psi ',
  '\u{1d714}': '\\omega ',
  '\u{1d715}': '\\partial ',
  '\u{1d716}': '\\varepsilon ',
  '\u{1d717}': '\\vartheta ',
  '\u{1d718}': '\\varkappa ',
  '\u{1d719}': '\\varphi ',
  '\u{1d71a}': '\\varrho ',
  '\u{1d71b}': '\\varpi ',
  // Relation symbols
  '\u2190': '\\leftarrow ',
  '\u2191': '\\uparrow ',
  // '\u2192' already defined above
  '\u2193': '\\downright ',
  '\u2194': '\\leftrightarrow ',
  '\u2195': '\\updownarrow ',
  '\u2196': '\\nwarrow ',
  '\u2197': '\\nearrow ',
  '\u2198': '\\searrow ',
  '\u2199': '\\swarrow ',
  '\u22ee': '\\vdots ',
  '\u22ef': '\\cdots ',
  '\u22f0': '\\adots ',
  '\u22f1': '\\ddots ',
  '\u2260': '\\ne ',
  '\u2264': '\\leq ',
  '\u2265': '\\geq ',
  '\u2266': '\\leqq ',
  '\u2267': '\\geqq ',
  '\u2268': '\\lneqq ',
  '\u2269': '\\gneqq ',
  '\u226a': '\\ll ',
  '\u226b': '\\gg ',
  '\u2208': '\\in ',
  '\u2209': '\\notin ',
  '\u220b': '\\ni ',
  '\u220c': '\\nni ',
  // Ordinary symbols
  '\u221e': '\\infty ',
  // Binary relations
  '\u00b1': '\\pm ',
  '\u2213': '\\mp ',
  // Italic, Latin, uppercase
  '\u{1d434}': 'A',
  '\u{1d435}': 'B',
  '\u{1d436}': 'C',
  '\u{1d437}': 'D',
  '\u{1d438}': 'E',
  '\u{1d439}': 'F',
  '\u{1d43a}': 'G',
  '\u{1d43b}': 'H',
  '\u{1d43c}': 'I',
  '\u{1d43d}': 'J',
  '\u{1d43e}': 'K',
  '\u{1d43f}': 'L',
  '\u{1d440}': 'M',
  '\u{1d441}': 'N',
  '\u{1d442}': 'O',
  '\u{1d443}': 'P',
  '\u{1d444}': 'Q',
  '\u{1d445}': 'R',
  '\u{1d446}': 'S',
  '\u{1d447}': 'T',
  '\u{1d448}': 'U',
  '\u{1d449}': 'V',
  '\u{1d44a}': 'W',
  '\u{1d44b}': 'X',
  '\u{1d44c}': 'Y',
  '\u{1d44d}': 'Z',
  // Italic, Latin, lowercase
  '\u{1d44e}': 'a',
  '\u{1d44f}': 'b',
  '\u{1d450}': 'c',
  '\u{1d451}': 'd',
  '\u{1d452}': 'e',
  '\u{1d453}': 'f',
  '\u{1d454}': 'g',
  '\u{1d456}': 'i',
  '\u{1d457}': 'j',
  '\u{1d458}': 'k',
  '\u{1d459}': 'l',
  '\u{1d45a}': 'm',
  '\u{1d45b}': 'n',
  '\u{1d45c}': 'o',
  '\u{1d45d}': 'p',
  '\u{1d45e}': 'q',
  '\u{1d45f}': 'r',
  '\u{1d460}': 's',
  '\u{1d461}': 't',
  '\u{1d462}': 'u',
  '\u{1d463}': 'v',
  '\u{1d464}': 'w',
  '\u{1d465}': 'x',
  '\u{1d466}': 'y',
  '\u{1d467}': 'z',
};

/**
 * Math function names -> LaTeX function templates.
 * `{fe}` is the placeholder for the function argument.
 */
export const FUNC: Record<string, string> = {
  sin: '\\sin({fe})',
  cos: '\\cos({fe})',
  tan: '\\tan({fe})',
  arcsin: '\\arcsin({fe})',
  arccos: '\\arccos({fe})',
  arctan: '\\arctan({fe})',
  arccot: '\\arccot({fe})',
  sinh: '\\sinh({fe})',
  cosh: '\\cosh({fe})',
  tanh: '\\tanh({fe})',
  coth: '\\coth({fe})',
  sec: '\\sec({fe})',
  csc: '\\csc({fe})',
};

/**
 * Default accent value for CHR lookups.
 */
export const CHR_DEFAULT: Record<string, string> = {
  ACC_VAL: '\\hat{{{0}}}',
};

/**
 * Bar position -> LaTeX command.
 */
export const POS: Record<string, string> = {
  top: '\\overline{{{0}}}',
  bot: '\\underline{{{0}}}',
};

/**
 * Default bar position value.
 */
export const POS_DEFAULT: Record<string, string> = {
  BAR_VAL: '\\overline{{{0}}}',
};

/** Subscript template. `{0}` = subscript content. */
export const SUB = '_{{{0}}}';

/** Superscript template. `{0}` = superscript content. */
export const SUP = '^{{{0}}}';

/**
 * Fraction type -> LaTeX template.
 * `{num}` and `{den}` are placeholders for numerator and denominator.
 */
export const F: Record<string, string> = {
  bar: '\\frac{{{num}}}{{{den}}}',
  skw: '^{{{num}}}/_{{{den}}}',
  noBar: '\\genfrac{{}}{{}}{0pt}{{}}{{{num}}}{{{den}}}',
  lin: '{{{num}}}/{{{den}}}',
};

/** Default fraction template. */
export const F_DEFAULT = '\\frac{{{num}}}{{{den}}}';

/** Delimiter template. `{left}`, `{text}`, `{right}` are placeholders. */
export const D = '\\left{left}{text}\\right{right}';

/** Default delimiter values. */
export const D_DEFAULT: Record<string, string> = {
  left: '(',
  right: ')',
  null: '.',
};

/** Radical template. `{deg}` = degree, `{text}` = radicand. */
export const RAD = '\\sqrt[{deg}]{{{text}}}';

/** Default radical template (no degree). */
export const RAD_DEFAULT = '\\sqrt{{{text}}}';

/** Array/equation array template. */
export const ARR = '\\begin{{array}}{{c}}{text}\\end{{array}}';

/**
 * Limit function names -> LaTeX templates.
 * `{lim}` = the limit expression.
 */
export const LIM_FUNC: Record<string, string> = {
  lim: '\\lim_{{{lim}}}',
  max: '\\max_{{{lim}}}',
  min: '\\min_{{{lim}}}',
};

/** Limit arrow symbols: [source, replacement]. */
export const LIM_TO: [string, string] = ['\\rightarrow', '\\to'];

/** Upper limit template. */
export const LIM_UPP = '\\overset{{{lim}}}{{{text}}}';

/** Matrix template. */
export const M = '\\begin{{matrix}}{text}\\end{{matrix}}';
