// @ts-nocheck
// src/utils/docx-math/omml-to-latex.ts
// Ported from Python: markitdown/converter_utils/docx/math/omml.py
// Adapted from https://github.com/xiilei/dwml/blob/master/dwml/omml.py
import { XMLParser } from '../../../../fast-xml-parser/src/fxp.js';
import { SAFE_XML_OPTIONS } from '../../xml-utils.js';
import { CHARS, CHR, CHR_BO, CHR_DEFAULT, POS, POS_DEFAULT, SUB, SUP, F, F_DEFAULT, T, FUNC, D, D_DEFAULT, RAD, RAD_DEFAULT, ARR, LIM_FUNC, LIM_TO, LIM_UPP, M, BRK, BLANK, BACKSLASH, ALN, FUNC_PLACE, } from './latex-dict.js';
/**
 * The OMML namespace prefix used in DOCX XML.
 */
const M_PREFIX = 'm:';
/**
 * Strip the `m:` namespace prefix from a tag name.
 */
function stripNs(tag) {
    if (tag.startsWith(M_PREFIX)) {
        return tag.slice(M_PREFIX.length);
    }
    return tag;
}
/**
 * Convert the fast-xml-parser JSON tree into our flat XmlElement list.
 *
 * fast-xml-parser returns objects like:
 *   { "m:f": { "m:num": { "m:r": { "m:t": "1" } }, "m:den": ... } }
 *
 * We need ordered children, so we parse with `preserveOrder: true` which gives:
 *   [ { "m:f": [ { "m:num": [...] }, ... ], ":@": { attrs } } ]
 */
function jsonToElement(node) {
    // With preserveOrder the node has exactly one key that is the tag name
    // (plus an optional ":@" key for attributes).
    const attrs = {};
    const attrObj = node[':@'];
    if (attrObj) {
        for (const [k, v] of Object.entries(attrObj)) {
            // Remove @_ prefix added by attributeNamePrefix
            const cleanKey = k.startsWith('@_') ? k.slice(2) : k;
            attrs[cleanKey] = String(v);
        }
    }
    // Find the tag key (not ":@")
    let tagName;
    let childrenRaw;
    for (const key of Object.keys(node)) {
        if (key === ':@')
            continue;
        tagName = key;
        childrenRaw = node[key];
        break;
    }
    if (!tagName)
        return null;
    const localTag = stripNs(tagName);
    // If childrenRaw is an array, recursively convert children
    const children = [];
    let text;
    if (Array.isArray(childrenRaw)) {
        for (const child of childrenRaw) {
            if (typeof child === 'object' && child !== null) {
                const childObj = child;
                // Check for text node: { "#text": "..." }
                if ('#text' in childObj) {
                    const tVal = childObj['#text'];
                    text = tVal !== undefined && tVal !== null ? String(tVal) : undefined;
                }
                else {
                    const el = jsonToElement(childObj);
                    if (el) {
                        children.push(el);
                    }
                }
            }
        }
    }
    else if (typeof childrenRaw === 'string' || typeof childrenRaw === 'number') {
        text = String(childrenRaw);
    }
    return { tag: localTag, attrs, children, text };
}
// ---------------------------------------------------------------------------
// Parser configuration
// ---------------------------------------------------------------------------
const OMML_PARSER_OPTIONS = {
    ...SAFE_XML_OPTIONS,
    preserveOrder: true,
    // We do NOT strip namespace prefixes �?we handle them ourselves via stripNs
    removeNSPrefix: false,
};
/**
 * Parse an OMML XML string and return the root XmlElement.
 */
function parseOmml(xml) {
    const parser = new XMLParser(OMML_PARSER_OPTIONS);
    const result = parser.parse(xml);
    if (!Array.isArray(result) || result.length === 0)
        return null;
    // result is an array of top-level nodes (preserveOrder mode)
    // We wrap them in a virtual root
    const children = [];
    for (const node of result) {
        const el = jsonToElement(node);
        if (el)
            children.push(el);
    }
    if (children.length === 1)
        return children[0];
    // Multiple top-level nodes �?wrap in a virtual root
    return { tag: '__root__', attrs: {}, children, text: undefined };
}
// ---------------------------------------------------------------------------
// Helper functions (ported from Python)
// ---------------------------------------------------------------------------
function escapeLatex(strs) {
    let last = null;
    const newChr = [];
    strs = strs.replace(/\\\\/g, '\\');
    for (const c of strs) {
        if (CHARS.has(c) && last !== BACKSLASH) {
            newChr.push(BACKSLASH + c);
        }
        else {
            newChr.push(c);
        }
        last = c;
    }
    return newChr.join(BLANK);
}
function getVal(key, defaultVal = undefined, store = CHR) {
    if (key != null) {
        return !store ? key : (store[key] ?? key);
    }
    return defaultVal;
}
/**
 * Python-style `.format()` replacement for named placeholders.
 * E.g. formatNamed("\\frac{{{num}}}{{{den}}}", { num: "1", den: "2" })
 *       -> "\\frac{1}{2}"
 *
 * The Python templates use `{{{name}}}` which means literal `{` + `{name}` + literal `}`.
 * After Python's `.format()`, `{{` -> `{`, `{name}` -> value, `}}` -> `}`.
 */
function formatNamed(template, values) {
    // First: unescape doubled braces temporarily
    let result = template;
    // Replace named placeholders
    for (const [key, val] of Object.entries(values)) {
        // Replace {key} with the value
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val ?? '');
    }
    // Unescape double braces: {{ -> { and }} -> }
    result = result.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    return result;
}
/**
 * Python-style positional `.format()` for `{0}` placeholders.
 */
function formatPositional(template, ...args) {
    let result = template;
    for (let i = 0; i < args.length; i++) {
        result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), args[i]);
    }
    result = result.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    return result;
}
/**
 * Find the text content of a child element with a specific local tag name.
 * Equivalent to Python: elm.findtext("./{ns}t")
 */
function findText(elm, localTag) {
    for (const child of elm.children) {
        if (child.tag === localTag) {
            // The text could be the direct text or nested in children
            if (child.text !== undefined)
                return child.text;
            // Also check for #text in children
            return undefined;
        }
    }
    return undefined;
}
/**
 * Get an attribute value from an element.
 * In OMML, attributes like `m:val` are accessed as `{ns}val`.
 * With fast-xml-parser, they appear as `m:val` in attrs.
 */
function getAttr(elm, localName) {
    // Try with m: prefix first, then without
    return elm.attrs[`m:${localName}`] ?? elm.attrs[localName];
}
const PR_VAL_TAGS = new Set(['chr', 'pos', 'begChr', 'endChr', 'type']);
const PR_TAG_METHODS = {
    brk: 'brk',
    chr: 'common',
    pos: 'common',
    begChr: 'common',
    endChr: 'common',
    type: 'common',
};
function processPr(elm) {
    const result = { text: '' };
    const textParts = [];
    for (const child of elm.children) {
        const stag = child.tag;
        const methodName = PR_TAG_METHODS[stag];
        if (methodName === 'brk') {
            result.brk = BRK;
            textParts.push(BRK);
        }
        else if (methodName === 'common') {
            if (PR_VAL_TAGS.has(stag)) {
                const val = getAttr(child, 'val');
                result[stag] = val ?? null;
            }
            // Returns null �?doesn't add to text
        }
        // Other children are ignored for Pr
    }
    result.text = textParts.join(BLANK);
    return result;
}
const DIRECT_TAGS = new Set([
    'box',
    'sSub',
    'sSup',
    'sSubSup',
    'num',
    'den',
    'deg',
    'e',
]);
/**
 * Process children of an element, yielding (tag, result, element) tuples.
 */
function* processChildrenList(elm, include) {
    for (const child of elm.children) {
        const stag = child.tag;
        // Only process elements that look like OMML elements
        // (In the Python code, this checks for the OMML namespace)
        if (include && !include.has(stag)) {
            continue;
        }
        let t = callMethod(child, stag);
        if (t === null) {
            t = processUnknown(child, stag);
            if (t === null) {
                continue;
            }
        }
        yield [stag, t, child];
    }
}
/**
 * Process children and return a dictionary of tag -> result.
 */
function processChildrenDict(elm, include) {
    const result = {};
    for (const [stag, t] of processChildrenList(elm, include)) {
        result[stag] = t;
    }
    return result;
}
/**
 * Process children and return concatenated string.
 */
function processChildren(elm, include) {
    const parts = [];
    for (const [, t] of processChildrenList(elm, include)) {
        if (typeof t === 'string') {
            parts.push(t);
        }
        else {
            // PrResult �?use its text representation
            parts.push(t.text);
        }
    }
    return parts.join(BLANK);
}
/**
 * Handle unknown tags �?either direct processing or Pr creation.
 */
function processUnknown(elm, stag) {
    if (DIRECT_TAGS.has(stag)) {
        return processChildren(elm);
    }
    if (stag.length >= 2 && stag.slice(-2) === 'Pr') {
        return processPr(elm);
    }
    return null;
}
// ---------------------------------------------------------------------------
// Tag method implementations
// ---------------------------------------------------------------------------
function doAcc(elm) {
    const cDict = processChildrenDict(elm);
    const pr = cDict['accPr'];
    const latexS = getVal(pr?.chr, CHR_DEFAULT['ACC_VAL'], CHR);
    return formatPositional(latexS, cDict['e'] ?? '');
}
function doBar(elm) {
    const cDict = processChildrenDict(elm);
    const pr = cDict['barPr'];
    const latexS = getVal(pr?.pos, POS_DEFAULT['BAR_VAL'], POS);
    return (pr?.text ?? '') + formatPositional(latexS, cDict['e'] ?? '');
}
function doD(elm) {
    const cDict = processChildrenDict(elm);
    const pr = cDict['dPr'];
    const nullChar = D_DEFAULT['null'];
    const sVal = getVal(pr?.begChr, D_DEFAULT['left'], T);
    const eVal = getVal(pr?.endChr, D_DEFAULT['right'], T);
    return ((pr?.text ?? '') +
        formatNamed(D, {
            left: !sVal ? nullChar : escapeLatex(sVal),
            text: cDict['e'] ?? '',
            right: !eVal ? nullChar : escapeLatex(eVal),
        }));
}
function doSub(elm) {
    const text = processChildren(elm);
    return formatPositional(SUB, text);
}
function doSup(elm) {
    const text = processChildren(elm);
    return formatPositional(SUP, text);
}
function doF(elm) {
    const cDict = processChildrenDict(elm);
    const pr = cDict['fPr'];
    const latexS = getVal(pr?.type, F_DEFAULT, F) ?? F_DEFAULT;
    return ((pr?.text ?? '') +
        formatNamed(latexS, {
            num: cDict['num'] ?? '',
            den: cDict['den'] ?? '',
        }));
}
function doFunc(elm) {
    const cDict = processChildrenDict(elm);
    const funcName = cDict['fName'] ?? '';
    return funcName.replace(FUNC_PLACE, cDict['e'] ?? '');
}
function doFName(elm) {
    const latexChars = [];
    for (const [stag, t] of processChildrenList(elm)) {
        if (stag === 'r') {
            const tStr = t;
            const funcTemplate = FUNC[tStr];
            if (funcTemplate) {
                latexChars.push(funcTemplate);
            }
            else {
                // Unsupported function �?fall back to raw text
                latexChars.push(tStr);
            }
        }
        else {
            latexChars.push(typeof t === 'string' ? t : t.text);
        }
    }
    const result = latexChars.join(BLANK);
    return result.includes(FUNC_PLACE) ? result : result + FUNC_PLACE;
}
function doGroupChr(elm) {
    const cDict = processChildrenDict(elm);
    const pr = cDict['groupChrPr'];
    const latexS = getVal(pr?.chr);
    return (pr?.text ?? '') + formatPositional(latexS, cDict['e'] ?? '');
}
function doRad(elm) {
    const cDict = processChildrenDict(elm);
    const text = cDict['e'] ?? '';
    const degText = cDict['deg'] ?? '';
    if (degText) {
        return formatNamed(RAD, { deg: degText, text });
    }
    return formatNamed(RAD_DEFAULT, { text });
}
function doEqArr(elm) {
    const includeSet = new Set(['e']);
    const rows = [];
    for (const [, t] of processChildrenList(elm, includeSet)) {
        rows.push(typeof t === 'string' ? t : t.text);
    }
    return formatNamed(ARR, { text: rows.join(BRK) });
}
function doLimLow(elm) {
    const includeSet = new Set(['e', 'lim']);
    const tDict = processChildrenDict(elm, includeSet);
    const eText = tDict['e'];
    const latexS = LIM_FUNC[eText];
    if (!latexS) {
        // Unsupported limit function �?fall back
        return eText ?? '';
    }
    return formatNamed(latexS, { lim: tDict['lim'] ?? '' });
}
function doLimUpp(elm) {
    const includeSet = new Set(['e', 'lim']);
    const tDict = processChildrenDict(elm, includeSet);
    return formatNamed(LIM_UPP, {
        lim: tDict['lim'] ?? '',
        text: tDict['e'] ?? '',
    });
}
function doLim(elm) {
    return processChildren(elm).replace(LIM_TO[0], LIM_TO[1]);
}
function doM(elm) {
    const rows = [];
    for (const [stag, t] of processChildrenList(elm)) {
        if (stag === 'mPr') {
            // skip
        }
        else if (stag === 'mr') {
            rows.push(typeof t === 'string' ? t : t.text);
        }
    }
    return formatNamed(M, { text: rows.join(BRK) });
}
function doMr(elm) {
    const includeSet = new Set(['e']);
    const cols = [];
    for (const [, t] of processChildrenList(elm, includeSet)) {
        cols.push(typeof t === 'string' ? t : t.text);
    }
    return cols.join(ALN);
}
function doNary(elm) {
    const res = [];
    let bo = '';
    for (const [stag, t] of processChildrenList(elm)) {
        if (stag === 'naryPr') {
            const pr = t;
            bo = getVal(pr.chr, undefined, CHR_BO) ?? '';
        }
        else {
            res.push(typeof t === 'string' ? t : t.text);
        }
    }
    return bo + res.join(BLANK);
}
function doR(elm) {
    // Find the <m:t> child and get its text content
    const tText = findText(elm, 't');
    if (!tText)
        return '';
    const parts = [];
    for (const c of tText) {
        parts.push(T[c] ?? c);
    }
    return escapeLatex(parts.join(BLANK));
}
// ---------------------------------------------------------------------------
// Tag dispatch table
// ---------------------------------------------------------------------------
const TAG_METHODS = {
    acc: doAcc,
    r: doR,
    bar: doBar,
    sub: doSub,
    sup: doSup,
    f: doF,
    func: doFunc,
    fName: doFName,
    groupChr: doGroupChr,
    d: doD,
    rad: doRad,
    eqArr: doEqArr,
    limLow: doLimLow,
    limUpp: doLimUpp,
    lim: doLim,
    m: doM,
    mr: doMr,
    nary: doNary,
};
function callMethod(elm, stag) {
    const tag = stag ?? elm.tag;
    const method = TAG_METHODS[tag];
    if (method) {
        return method(elm);
    }
    return null;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Convert a single OMML `<m:oMath>` XML string to a LaTeX string.
 *
 * @param ommlXml - An XML string containing an `<m:oMath>` element
 *                  (or the oMath element itself as root).
 * @returns The LaTeX representation of the math expression.
 */
export function ommlToLatex(ommlXml) {
    const root = parseOmml(ommlXml);
    if (!root)
        return '';
    // If the root is an oMath element, process it directly
    if (root.tag === 'oMath') {
        return processChildren(root);
    }
    // If the root is oMathPara, find oMath children
    if (root.tag === 'oMathPara') {
        const results = [];
        for (const child of root.children) {
            if (child.tag === 'oMath') {
                results.push(processChildren(child));
            }
        }
        return results.join(' ');
    }
    // Otherwise look for oMath elements in children
    const results = [];
    for (const child of root.children) {
        if (child.tag === 'oMath') {
            results.push(processChildren(child));
        }
        else if (child.tag === 'oMathPara') {
            for (const grandchild of child.children) {
                if (grandchild.tag === 'oMath') {
                    results.push(processChildren(grandchild));
                }
            }
        }
    }
    return results.join(' ');
}
/**
 * Process a full DOCX XML document string, finding all `<m:oMathPara>` and
 * `<m:oMath>` elements, converting them to LaTeX, and replacing them with
 * `<w:p><w:r><w:t>$latex$</w:t></w:r></w:p>` (for inline oMath) or
 * display math `$$latex$$` (for oMathPara).
 *
 * @param xml - The full DOCX document XML string
 * @returns The modified XML string with math elements replaced by LaTeX
 */
export function processOmmlInXml(xml) {
    let result = xml;
    // First handle <m:oMathPara>...</m:oMathPara> (display math)
    // These wrap one or more <m:oMath> elements
    result = result.replace(/<m:oMathPara[\s>][\s\S]*?<\/m:oMathPara>/g, (match) => {
        try {
            const latex = ommlToLatex(match);
            if (!latex)
                return match;
            return `<w:p><w:r><w:t>$$${latex}$$</w:t></w:r></w:p>`;
        }
        catch {
            return match;
        }
    });
    // Then handle standalone <m:oMath>...</m:oMath> (inline math)
    // that were NOT already inside an oMathPara (which we already replaced)
    result = result.replace(/<m:oMath[\s>][\s\S]*?<\/m:oMath>/g, (match) => {
        try {
            const latex = ommlToLatex(match);
            if (!latex)
                return match;
            return `<w:r><w:t>$${latex}$</w:t></w:r>`;
        }
        catch {
            return match;
        }
    });
    return result;
}
//# sourceMappingURL=omml-to-latex.js.map