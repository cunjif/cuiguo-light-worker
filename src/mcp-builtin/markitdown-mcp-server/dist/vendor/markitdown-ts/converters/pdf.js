import { MissingDependencyError } from '../errors.js';
const ACCEPTED_MIME_PREFIXES = ['application/pdf', 'application/x-pdf'];
const ACCEPTED_EXTENSIONS = ['.pdf'];
/** Pattern for MasterFormat-style partial numbering (e.g., ".1", ".2", ".10") */
const PARTIAL_NUMBERING_PATTERN = /^\.\d+$/;
/**
 * Post-process extracted text to merge MasterFormat-style partial numbering
 * with the following text line.
 *
 * MasterFormat documents use partial numbering like:
 *     .1  The intent of this Request for Proposal...
 *     .2  Available information relative to...
 *
 * Some PDF extractors split these into separate lines:
 *     .1
 *     The intent of this Request for Proposal...
 *
 * This function merges them back together.
 */
function mergePartialNumberingLines(text) {
    const lines = text.split('\n');
    const resultLines = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const stripped = line.trim();
        // Check if this line is ONLY a partial numbering
        if (PARTIAL_NUMBERING_PATTERN.test(stripped)) {
            // Look for the next non-empty line to merge with
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) {
                j++;
            }
            if (j < lines.length) {
                // Merge the partial numbering with the next line
                const nextLine = lines[j].trim();
                resultLines.push(`${stripped} ${nextLine}`);
                i = j + 1; // Skip past the merged line
            }
            else {
                // No next line to merge with, keep as is
                resultLines.push(line);
                i++;
            }
        }
        else {
            resultLines.push(line);
            i++;
        }
    }
    return resultLines.join('\n');
}
/**
 * Extract form-style content from a PDF page by analyzing word positions.
 * This handles borderless forms/tables where words are aligned in columns.
 *
 * Returns markdown with proper table formatting:
 * - Tables have pipe-separated columns with header separator rows
 * - Non-table content is rendered as plain text
 *
 * Returns null if the page doesn't appear to be a form-style document.
 */
function extractFormContentFromWords(words, pageWidth) {
    if (words.length === 0) {
        return null;
    }
    // Group words by their Y position (rows)
    const yTolerance = 5;
    const rowsByY = new Map();
    for (const word of words) {
        const yKey = Math.round(word.y0 / yTolerance) * yTolerance;
        let row = rowsByY.get(yKey);
        if (!row) {
            row = [];
            rowsByY.set(yKey, row);
        }
        row.push(word);
    }
    // Sort rows by Y position (top to bottom)
    const sortedYKeys = [...rowsByY.keys()].sort((a, b) => a - b);
    // First pass: analyze each row
    const rowInfo = [];
    for (const yKey of sortedYKeys) {
        const rowWords = [...rowsByY.get(yKey)].sort((a, b) => a.x0 - b.x0);
        if (rowWords.length === 0)
            continue;
        const firstX0 = rowWords[0].x0;
        const lastX1 = rowWords[rowWords.length - 1].x1;
        const lineWidth = lastX1 - firstX0;
        const combinedText = rowWords.map((w) => w.text).join(' ');
        // Count distinct x-position groups (columns)
        const xPositions = rowWords.map((w) => w.x0);
        const xGroups = [];
        for (const x of [...xPositions].sort((a, b) => a - b)) {
            if (xGroups.length === 0 || x - xGroups[xGroups.length - 1] > 50) {
                xGroups.push(x);
            }
        }
        // Determine row type
        const isParagraph = lineWidth > pageWidth * 0.55 && combinedText.length > 60;
        // Check for MasterFormat-style partial numbering (e.g., ".1", ".2")
        let hasPartialNumbering = false;
        if (rowWords.length > 0) {
            const firstWord = rowWords[0].text.trim();
            if (PARTIAL_NUMBERING_PATTERN.test(firstWord)) {
                hasPartialNumbering = true;
            }
        }
        rowInfo.push({
            yKey,
            words: rowWords,
            text: combinedText,
            xGroups,
            isParagraph,
            numColumns: xGroups.length,
            hasPartialNumbering,
            isTableRow: false, // Will be set below
        });
    }
    // Collect ALL x-positions from rows with 3+ columns (table-like rows)
    const allTableXPositions = [];
    for (const info of rowInfo) {
        if (info.numColumns >= 3 && !info.isParagraph) {
            allTableXPositions.push(...info.xGroups);
        }
    }
    if (allTableXPositions.length === 0) {
        return null;
    }
    // Compute adaptive column clustering tolerance based on gap analysis
    allTableXPositions.sort((a, b) => a - b);
    // Calculate gaps between consecutive x-positions
    const gaps = [];
    for (let i = 0; i < allTableXPositions.length - 1; i++) {
        const gap = allTableXPositions[i + 1] - allTableXPositions[i];
        if (gap > 5) {
            // Only significant gaps
            gaps.push(gap);
        }
    }
    // Determine optimal tolerance using statistical analysis
    let adaptiveTolerance;
    if (gaps.length >= 3) {
        // Use 70th percentile of gaps as threshold (balances precision/recall)
        const sortedGaps = [...gaps].sort((a, b) => a - b);
        const percentile70Idx = Math.floor(sortedGaps.length * 0.7);
        adaptiveTolerance = sortedGaps[percentile70Idx];
        // Clamp tolerance to reasonable range [25, 50]
        adaptiveTolerance = Math.max(25, Math.min(50, adaptiveTolerance));
    }
    else {
        // Fallback to conservative value
        adaptiveTolerance = 35;
    }
    // Compute global column boundaries using adaptive tolerance
    const globalColumns = [];
    for (const x of allTableXPositions) {
        if (globalColumns.length === 0 || x - globalColumns[globalColumns.length - 1] > adaptiveTolerance) {
            globalColumns.push(x);
        }
    }
    // Adaptive max column check based on page characteristics
    if (globalColumns.length > 1) {
        const contentWidth = globalColumns[globalColumns.length - 1] - globalColumns[0];
        const avgColWidth = contentWidth / globalColumns.length;
        // Forms with very narrow columns (< 30px) are likely dense text
        if (avgColWidth < 30) {
            return null;
        }
        // Compute adaptive max based on columns per inch
        const columnsPerInch = globalColumns.length / (contentWidth / 72);
        // If density is too high (> 10 cols/inch), likely not a form
        if (columnsPerInch > 10) {
            return null;
        }
        // Adaptive max: allow more columns for wider pages
        const adaptiveMaxColumns = Math.max(15, Math.floor(20 * (pageWidth / 612)));
        if (globalColumns.length > adaptiveMaxColumns) {
            return null;
        }
    }
    else {
        // Single column, not a form
        return null;
    }
    // Now classify each row as table row or not
    const numCols = globalColumns.length;
    for (const info of rowInfo) {
        if (info.isParagraph) {
            info.isTableRow = false;
            continue;
        }
        // Rows with partial numbering are list items, not table rows
        if (info.hasPartialNumbering) {
            info.isTableRow = false;
            continue;
        }
        // Count how many global columns this row's words align with
        const alignedColumns = new Set();
        for (const word of info.words) {
            const wordX = word.x0;
            for (let colIdx = 0; colIdx < globalColumns.length; colIdx++) {
                if (Math.abs(wordX - globalColumns[colIdx]) < 40) {
                    alignedColumns.add(colIdx);
                    break;
                }
            }
        }
        // If row uses 2+ of the established columns, it's a table row
        info.isTableRow = alignedColumns.size >= 2;
    }
    // Find table regions (consecutive table rows)
    const tableRegions = [];
    let i = 0;
    while (i < rowInfo.length) {
        if (rowInfo[i].isTableRow) {
            const startIdx = i;
            while (i < rowInfo.length && rowInfo[i].isTableRow) {
                i++;
            }
            tableRegions.push([startIdx, i]);
        }
        else {
            i++;
        }
    }
    // Check if enough rows are table rows (at least 20%)
    const totalTableRows = tableRegions.reduce((sum, [start, end]) => sum + (end - start), 0);
    if (rowInfo.length > 0 && totalTableRows / rowInfo.length < 0.2) {
        return null;
    }
    // Helper function to extract cells from a row
    function extractCells(info) {
        const cells = new Array(numCols).fill('');
        for (const word of info.words) {
            const wordX = word.x0;
            // Find the correct column using boundary ranges
            let assignedCol = numCols - 1; // Default to last column
            for (let colIdx = 0; colIdx < numCols - 1; colIdx++) {
                const colEnd = globalColumns[colIdx + 1];
                if (wordX < colEnd - 20) {
                    assignedCol = colIdx;
                    break;
                }
            }
            if (cells[assignedCol]) {
                cells[assignedCol] += ' ' + word.text;
            }
            else {
                cells[assignedCol] = word.text;
            }
        }
        return cells;
    }
    // Build output - collect table data first, then format with proper column widths
    const resultLines = [];
    let idx = 0;
    while (idx < rowInfo.length) {
        const info = rowInfo[idx];
        // Check if this row starts a table region
        let tableRegion = null;
        for (const [start, end] of tableRegions) {
            if (idx === start) {
                tableRegion = [start, end];
                break;
            }
        }
        if (tableRegion) {
            const [start, end] = tableRegion;
            // Collect all rows in this table
            const tableData = [];
            for (let tableIdx = start; tableIdx < end; tableIdx++) {
                const cells = extractCells(rowInfo[tableIdx]);
                tableData.push(cells);
            }
            // Calculate column widths for this table
            if (tableData.length > 0) {
                const colWidths = [];
                for (let col = 0; col < numCols; col++) {
                    let maxLen = 3; // Minimum width for separator dashes
                    for (const row of tableData) {
                        maxLen = Math.max(maxLen, row[col].length);
                    }
                    colWidths.push(maxLen);
                }
                // Format header row
                const header = tableData[0];
                const headerStr = '| ' +
                    header.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') +
                    ' |';
                resultLines.push(headerStr);
                // Format separator row
                const separator = '| ' +
                    colWidths.map((w) => '-'.repeat(w)).join(' | ') +
                    ' |';
                resultLines.push(separator);
                // Format data rows
                for (let r = 1; r < tableData.length; r++) {
                    const row = tableData[r];
                    const rowStr = '| ' +
                        row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') +
                        ' |';
                    resultLines.push(rowStr);
                }
            }
            idx = end; // Skip to end of table region
        }
        else {
            // Check if we're inside a table region (not at start)
            let inTable = false;
            for (const [start, end] of tableRegions) {
                if (start < idx && idx < end) {
                    inTable = true;
                    break;
                }
            }
            if (!inTable) {
                // Non-table content
                resultLines.push(info.text);
            }
            idx++;
        }
    }
    return resultLines.join('\n');
}
/**
 * Extract words from pdfjs text content items, converting to top-origin coordinates.
 *
 * Each pdfjs text item is emitted as a single spatial unit rather than split
 * into sub-words. pdfjs groups glyphs into text items by proximity during
 * parsing, so a multi-word chunk like "This chapter sets out requirements"
 * represents a single contiguous run of prose with one real x-start and a
 * known width. Splitting it into synthetic sub-words at fabricated
 * x-positions caused prose lines to be mis-classified as multi-column
 * tables by `extractFormContentFromWords`, because each fake sub-word
 * landed at a distinct x-position far enough apart to be counted as its
 * own column group. This matches pdfplumber's behaviour in the Python
 * port (pdfplumber's `extract_words` groups glyphs spatially; it does not
 * invent x-positions by splitting text on whitespace).
 */
function extractWords(items, pageHeight) {
    const words = [];
    for (const item of items) {
        const text = item.str.trim();
        if (!text)
            continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width;
        const h = item.height;
        // Convert from PDF coordinates (y increases upward) to top-origin
        // (y increases downward).
        const top = pageHeight - y;
        const bottom = top + Math.abs(h);
        words.push({
            text,
            x0: x,
            y0: top,
            x1: x + w,
            y1: bottom,
        });
    }
    return words;
}
/**
 * Simple text extraction: join text items in reading order.
 */
function extractSimpleText(items, pageHeight) {
    // Group items by Y position to detect lines
    const yTolerance = 3;
    const linesByY = new Map();
    for (const item of items) {
        const y = item.transform[5];
        const top = pageHeight - y;
        const yKey = Math.round(top / yTolerance) * yTolerance;
        let line = linesByY.get(yKey);
        if (!line) {
            line = [];
            linesByY.set(yKey, line);
        }
        line.push({ str: item.str, x: item.transform[4] });
    }
    // Sort lines top-to-bottom, items left-to-right
    const sortedYKeys = [...linesByY.keys()].sort((a, b) => a - b);
    const lines = [];
    for (const yKey of sortedYKeys) {
        const lineItems = linesByY.get(yKey).sort((a, b) => a.x - b.x);
        const lineText = lineItems.map((li) => li.str).join('');
        if (lineText.trim()) {
            lines.push(lineText.trim());
        }
    }
    return lines.join('\n');
}
/** Annotation type constants from PDF spec */
const COMMENT_ANNOTATION_TYPES = new Set([1, 3, 9, 10, 11, 12]); // TEXT, FREETEXT, HIGHLIGHT, UNDERLINE, SQUIGGLY, STRIKEOUT
/**
 * Extract comment-type annotations from a PDF page and format as markdown.
 */
async function extractAnnotationComments(page) {
    const annotations = await page.getAnnotations({ intent: 'any' });
    const pageComments = [];
    for (const annot of annotations) {
        if (!COMMENT_ANNOTATION_TYPES.has(annot.annotationType))
            continue;
        const text = annot.contentsObj?.str ?? '';
        if (!text.trim())
            continue;
        const author = annot.titleObj?.str ?? '';
        const subtype = annot.subtype ?? 'Note';
        pageComments.push({ author, text: text.trim(), type: subtype });
    }
    if (pageComments.length === 0)
        return null;
    let commentSection = '\n\n### Comments\n';
    for (const c of pageComments) {
        if (c.author) {
            commentSection += `- **${c.author}** (${c.type}): ${c.text}\n`;
        }
        else {
            commentSection += `- (${c.type}): ${c.text}\n`;
        }
    }
    return commentSection.trimEnd();
}
export class PdfConverter {
    accepts(info) {
        const ext = info.extension?.toLowerCase();
        if (ext && ACCEPTED_EXTENSIONS.includes(ext))
            return true;
        const mime = info.mimetype?.toLowerCase() ?? '';
        for (const prefix of ACCEPTED_MIME_PREFIXES) {
            if (mime.startsWith(prefix))
                return true;
        }
        return false;
    }
    async convert(input, _info, _opts) {
        const injected = _opts.nodeServices;
        // Prefer an injected pdfjs-dist module when the consumer has provided
        // one (e.g. via MarkItDownOptions.nodeServices.pdfjsLib). This is
        // required in bundled serverless environments (Next.js on Vercel with
        // pnpm) where markitdown-ts is loaded outside the bundler's module
        // graph and Node can't walk up to find pdfjs-dist at runtime.
        let pdfjsLib;
        if (injected?.pdfjsLib) {
            pdfjsLib = injected.pdfjsLib;
        }
        else {
            try {
                pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            }
            catch (err) {
                throw new MissingDependencyError('pdfjs-dist', 'pnpm add pdfjs-dist, or pass nodeServices.pdfjsLib to MarkItDown for bundled/serverless environments. Underlying resolution error: '
                    + (err instanceof Error ? `${err.name}: ${err.message}` : String(err)));
            }
        }
        // Pre-load the worker message handler on the main thread. pdfjs-dist's
        // Node.js "fake worker" setup tries to dynamically import pdf.worker.mjs
        // relative to the main module path, which fails when bundlers (Next.js,
        // webpack, turbopack) relocate the code to chunk directories. By loading
        // the worker module and setting globalThis.pdfjsWorker, we bypass the
        // file-path-based import entirely.
        if (!globalThis.pdfjsWorker) {
            if (injected?.pdfjsWorker) {
                globalThis.pdfjsWorker = injected.pdfjsWorker;
            }
            else {
                try {
                    const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
                    globalThis.pdfjsWorker = workerModule;
                }
                catch {
                    // Worker pre-load failed �?pdfjs will fall back to its own resolution
                }
            }
        }
        // Resolve pdfjs-dist package location for standard fonts.
        // import.meta.resolve works in ESM but tsup's CJS shim sets import_meta = {},
        // so we fall back to createRequire anchored to __filename (CJS).
        // In bundled environments (Next.js), neither works �?fonts are optional
        // unless the consumer injects nodeServices.pdfjsStandardFontDataUrl.
        let standardFontDataUrl = injected?.pdfjsStandardFontDataUrl;
        if (!standardFontDataUrl) {
            try {
                const { dirname, join } = await import('path');
                let pdfjsBuildDir;
                try {
                    const { fileURLToPath } = await import('url');
                    pdfjsBuildDir = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs')));
                }
                catch {
                    const { createRequire } = await import('module');
                    const anchor = (typeof import.meta.url === 'string' && import.meta.url.startsWith('file:'))
                        ? import.meta.url
                        : (typeof __filename === 'string')
                            ? __filename
                            : undefined;
                    if (anchor) {
                        const req = createRequire(anchor);
                        pdfjsBuildDir = dirname(req.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
                    }
                }
                if (pdfjsBuildDir) {
                    standardFontDataUrl = join(pdfjsBuildDir, '..', '..', 'standard_fonts/');
                }
            }
            catch {
                // Font path resolution failed �?PDFs with standard fonts may show warnings
            }
        }
        const buffer = await input.buffer();
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: false,
            disableFontFace: true,
            ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
        });
        const doc = await loadingTask.promise;
        try {
            const markdownChunks = [];
            const pageErrors = [];
            let formPageCount = 0;
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                // Wrap each page in try/catch so one malformed page does not kill
                // extraction of the entire document. pdfjs-dist can throw from
                // getPage/getViewport/getTextContent/getAnnotations for a variety
                // of reasons (corrupt streams, unsupported encodings, missing
                // fonts, XFA forms, etc). We record per-page errors but keep going.
                let page = null;
                try {
                    page = await doc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.0 });
                    const pageHeight = viewport.height;
                    const pageWidth = viewport.width;
                    // Text extraction �?individually wrapped so annotation extraction
                    // can still run even if text extraction fails, and vice versa.
                    try {
                        const textContent = await page.getTextContent();
                        // Filter to TextItem only (exclude TextMarkedContent)
                        const textItems = textContent.items.filter((item) => 'str' in item);
                        if (textItems.length > 0) {
                            // Try spatial analysis first (form/table detection)
                            const words = extractWords(textItems, pageHeight);
                            const formContent = extractFormContentFromWords(words, pageWidth);
                            if (formContent !== null) {
                                formPageCount++;
                                if (formContent.trim()) {
                                    markdownChunks.push(formContent);
                                }
                            }
                            else {
                                // Fall back to simple text extraction
                                const simpleText = extractSimpleText(textItems, pageHeight);
                                if (simpleText.trim()) {
                                    markdownChunks.push(simpleText.trim());
                                }
                            }
                        }
                    }
                    catch (textErr) {
                        pageErrors.push({
                            pageNum,
                            error: `text extraction: ${textErr instanceof Error ? textErr.message : String(textErr)}`,
                        });
                    }
                    // Annotations �?independent from text extraction
                    try {
                        const commentSection = await extractAnnotationComments(page);
                        if (commentSection) {
                            markdownChunks.push(commentSection);
                        }
                    }
                    catch (annotErr) {
                        pageErrors.push({
                            pageNum,
                            error: `annotations: ${annotErr instanceof Error ? annotErr.message : String(annotErr)}`,
                        });
                    }
                }
                catch (pageErr) {
                    pageErrors.push({
                        pageNum,
                        error: `page load: ${pageErr instanceof Error ? pageErr.message : String(pageErr)}`,
                    });
                }
                finally {
                    if (page) {
                        try {
                            page.cleanup();
                        }
                        catch {
                            /* cleanup errors are non-fatal */
                        }
                    }
                }
            }
            let markdown = markdownChunks.join('\n\n').trim();
            // If no pages had form-style content, the simple text path was used for all.
            // (In the Python version, this would fall back to pdfminer; here we've already
            // used the simple text extraction which is our equivalent.)
            // Post-process to merge MasterFormat-style partial numbering
            markdown = mergePartialNumberingLines(markdown);
            // If every page errored out AND we collected no content, surface
            // the per-page error details as a hard failure. A PDF where every
            // page throws is not a successful conversion.
            //
            // A PDF with zero text items but no errors (e.g. a scanned/image-only
            // PDF) is a valid empty result �?callers should OCR separately.
            if (pageErrors.length === doc.numPages && !markdown.trim()) {
                const errorSummary = pageErrors
                    .map((e) => `page ${e.pageNum}: ${e.error}`)
                    .join(' | ');
                throw new Error(`PDF conversion failed on all ${doc.numPages} page(s): ${errorSummary}`);
            }
            // If we got some content but also had per-page errors, prepend a
            // warning note so callers can surface partial-extraction issues.
            if (pageErrors.length > 0) {
                const errorNote = pageErrors
                    .map((e) => `- page ${e.pageNum}: ${e.error}`)
                    .join('\n');
                markdown =
                    `> _Note: ${pageErrors.length} of ${doc.numPages} page(s) had extraction errors:_\n>\n${errorNote.replace(/^/gm, '> ')}\n\n${markdown}`;
            }
            return { markdown };
        }
        finally {
            await doc.destroy();
        }
    }
}
//# sourceMappingURL=pdf.js.map