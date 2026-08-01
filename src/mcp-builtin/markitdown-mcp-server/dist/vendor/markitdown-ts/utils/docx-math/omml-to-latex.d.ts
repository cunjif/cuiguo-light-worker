/**
 * Convert a single OMML `<m:oMath>` XML string to a LaTeX string.
 *
 * @param ommlXml - An XML string containing an `<m:oMath>` element
 *                  (or the oMath element itself as root).
 * @returns The LaTeX representation of the math expression.
 */
export declare function ommlToLatex(ommlXml: string): string;
/**
 * Process a full DOCX XML document string, finding all `<m:oMathPara>` and
 * `<m:oMath>` elements, converting them to LaTeX, and replacing them with
 * `<w:p><w:r><w:t>$latex$</w:t></w:r></w:p>` (for inline oMath) or
 * display math `$$latex$$` (for oMathPara).
 *
 * @param xml - The full DOCX document XML string
 * @returns The modified XML string with math elements replaced by LaTeX
 */
export declare function processOmmlInXml(xml: string): string;
