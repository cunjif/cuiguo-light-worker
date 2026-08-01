/**
 * Characters that need escaping in LaTeX.
 */
export declare const CHARS: ReadonlySet<string>;
export declare const BLANK = "";
export declare const BACKSLASH = "\\";
export declare const ALN = "&";
export declare const BRK = "\\\\";
export declare const FUNC_PLACE = "{fe}";
/**
 * Unicode char -> LaTeX accent/grouping command.
 * Values use `{0}` as a placeholder for the accented content.
 */
export declare const CHR: Record<string, string>;
/**
 * Big operators: Unicode char -> LaTeX command.
 */
export declare const CHR_BO: Record<string, string>;
/**
 * Text/symbol translation table: Unicode char -> LaTeX representation.
 * Includes Greek letters, relation symbols, ordinary symbols, binary relations,
 * and italic Latin letters.
 */
export declare const T: Record<string, string>;
/**
 * Math function names -> LaTeX function templates.
 * `{fe}` is the placeholder for the function argument.
 */
export declare const FUNC: Record<string, string>;
/**
 * Default accent value for CHR lookups.
 */
export declare const CHR_DEFAULT: Record<string, string>;
/**
 * Bar position -> LaTeX command.
 */
export declare const POS: Record<string, string>;
/**
 * Default bar position value.
 */
export declare const POS_DEFAULT: Record<string, string>;
/** Subscript template. `{0}` = subscript content. */
export declare const SUB = "_{{{0}}}";
/** Superscript template. `{0}` = superscript content. */
export declare const SUP = "^{{{0}}}";
/**
 * Fraction type -> LaTeX template.
 * `{num}` and `{den}` are placeholders for numerator and denominator.
 */
export declare const F: Record<string, string>;
/** Default fraction template. */
export declare const F_DEFAULT = "\\frac{{{num}}}{{{den}}}";
/** Delimiter template. `{left}`, `{text}`, `{right}` are placeholders. */
export declare const D = "\\left{left}{text}\\right{right}";
/** Default delimiter values. */
export declare const D_DEFAULT: Record<string, string>;
/** Radical template. `{deg}` = degree, `{text}` = radicand. */
export declare const RAD = "\\sqrt[{deg}]{{{text}}}";
/** Default radical template (no degree). */
export declare const RAD_DEFAULT = "\\sqrt{{{text}}}";
/** Array/equation array template. */
export declare const ARR = "\\begin{{array}}{{c}}{text}\\end{{array}}";
/**
 * Limit function names -> LaTeX templates.
 * `{lim}` = the limit expression.
 */
export declare const LIM_FUNC: Record<string, string>;
/** Limit arrow symbols: [source, replacement]. */
export declare const LIM_TO: [string, string];
/** Upper limit template. */
export declare const LIM_UPP = "\\overset{{{lim}}}{{{text}}}";
/** Matrix template. */
export declare const M = "\\begin{{matrix}}{text}\\end{{matrix}}";
