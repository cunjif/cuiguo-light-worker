// @ts-nocheck
// src/converters/pptx.ts
import type { DocumentConverter, StreamInfo, ConverterInput, InternalConvertOptions, ConvertResult } from '../types.js';
import { MissingDependencyError } from '../errors.js';
import { HtmlConverter } from './html.js';
import { XMLParser } from 'fast-xml-parser';
import { SAFE_XML_OPTIONS } from '../xml-utils.js';

const ACCEPTED_EXTENSIONS = ['.pptx'];
const ACCEPTED_MIME_PREFIXES = [
  'application/vnd.openxmlformats-officedocument.presentationml',
];

// Namespace-aware tag names as produced by fast-xml-parser
const SLIDE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const CHART_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

export class PptxConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();
  private parser = new XMLParser(SAFE_XML_OPTIONS);

  accepts(info: StreamInfo): boolean {
    const ext = (info.extension ?? '').toLowerCase();
    const mime = (info.mimetype ?? '').toLowerCase();

    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    for (const prefix of ACCEPTED_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) return true;
    }
    return false;
  }

  async convert(
    input: ConverterInput,
    _info: StreamInfo,
    opts: InternalConvertOptions,
  ): Promise<ConvertResult | null> {
    let JSZip: typeof import('../../jszip/lib/index.js');
    try {
      JSZip = await import('../../jszip/lib/index.js');
    } catch {
      throw new MissingDependencyError('jszip', 'pnpm add jszip');
    }

    const buffer = await input.buffer();
    const zip = await JSZip.default.loadAsync(buffer);

    // 1. Parse presentation.xml to get slide order
    const presXml = await this.readZipText(zip, 'ppt/presentation.xml');
    if (!presXml) return null;
    const presDoc = this.parser.parse(presXml);

    // 2. Parse presentation relationships
    const presRelsXml = await this.readZipText(zip, 'ppt/_rels/presentation.xml.rels');
    if (!presRelsXml) return null;
    const presRelsDoc = this.parser.parse(presRelsXml);

    // Build rId -> target mapping
    const relMap = new Map<string, string>();
    const rels = this.ensureArray(presRelsDoc?.Relationships?.Relationship);
    for (const rel of rels) {
      const id = rel['@_Id'];
      const target = rel['@_Target'];
      if (id && target) relMap.set(id, target);
    }

    // 3. Get slide list in order
    const presentation = presDoc['p:presentation'] ?? presDoc.presentation ?? presDoc;
    const sldIdLst = presentation['p:sldIdLst'] ?? presentation.sldIdLst;
    const sldIds = this.ensureArray(sldIdLst?.['p:sldId'] ?? sldIdLst?.sldId);

    const slidePaths: string[] = [];
    for (const sld of sldIds) {
      const rId = sld['@_r:id'] ?? sld['@_rId'];
      if (rId && relMap.has(rId)) {
        const target = relMap.get(rId)!;
        // Targets are relative to ppt/
        const path = target.startsWith('slides/') ? `ppt/${target}` : target;
        slidePaths.push(path);
      }
    }

    // 4. Parse comment authors
    const authorMap = new Map<string, string>();
    const authorsXml = await this.readZipText(zip, 'ppt/commentAuthors.xml');
    if (authorsXml) {
      const authorsDoc = this.parser.parse(authorsXml);
      const authors = this.ensureArray(
        authorsDoc?.['p:cmAuthorLst']?.['p:cmAuthor'] ??
        authorsDoc?.cmAuthorLst?.cmAuthor
      );
      for (const a of authors) {
        authorMap.set(String(a['@_id']), a['@_name'] ?? 'Unknown');
      }
    }

    // 5. Process each slide
    let mdContent = '';
    let slideNum = 0;

    for (const slidePath of slidePaths) {
      slideNum++;
      mdContent += `\n\n<!-- Slide number: ${slideNum} -->\n`;

      const slideXml = await this.readZipText(zip, slidePath);
      if (!slideXml) continue;
      const slideDoc = this.parser.parse(slideXml);

      // Parse slide relationships for chart references
      const slideRelsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      const slideRelsMap = new Map<string, { type: string; target: string }>();
      const slideRelsXml = await this.readZipText(zip, slideRelsPath);
      if (slideRelsXml) {
        const slideRelsDoc = this.parser.parse(slideRelsXml);
        const slideRels = this.ensureArray(slideRelsDoc?.Relationships?.Relationship);
        for (const rel of slideRels) {
          slideRelsMap.set(rel['@_Id'], {
            type: rel['@_Type'] ?? '',
            target: rel['@_Target'] ?? '',
          });
        }
      }

      // Get the shape tree
      const sld = slideDoc['p:sld'] ?? slideDoc.sld ?? slideDoc;
      const cSld = sld['p:cSld'] ?? sld.cSld ?? sld;
      const spTree = cSld['p:spTree'] ?? cSld.spTree;
      if (!spTree) continue;

      // Detect title shape
      const titleShapeId = this.findTitleShapeId(spTree);

      // Collect all shapes, sort by position (top, then left)
      const shapes = this.collectShapes(spTree);
      const sortedShapes = this.sortShapesByPosition(shapes);

      for (const shape of sortedShapes) {
        mdContent += this.processShape(shape, titleShapeId, slideRelsMap, zip, opts);
      }

      // Process charts from graphic frames
      const graphicFrames = this.collectGraphicFrames(spTree);
      for (const frame of graphicFrames) {
        mdContent += await this.processGraphicFrame(frame, slideRelsMap, zip, opts);
      }

      mdContent = mdContent.trimEnd();

      // Check for slide notes
      const notesPath = slidePath.replace('slides/slide', 'notesSlides/notesSlide');
      const notesXml = await this.readZipText(zip, notesPath);
      if (notesXml) {
        const notesDoc = this.parser.parse(notesXml);
        const notesText = this.extractNotesText(notesDoc);
        if (notesText) {
          mdContent += `\n\n### Notes:\n${notesText}`;
        }
      }

      // Check for slide comments via relationships
      for (const [, rel] of slideRelsMap) {
        if (rel.type.includes('comments')) {
          const commentPath = rel.target.startsWith('../')
            ? 'ppt/' + rel.target.slice(3)
            : rel.target.startsWith('ppt/') ? rel.target : 'ppt/' + rel.target;
          const commentXml = await this.readZipText(zip, commentPath);
          if (commentXml) {
            const commentDoc = this.parser.parse(commentXml);
            const comments = this.ensureArray(
              commentDoc?.['p:cmLst']?.['p:cm'] ??
              commentDoc?.cmLst?.cm
            );
            if (comments.length > 0) {
              mdContent += '\n\n### Comments:\n';
              for (const cm of comments) {
                const authorId = String(cm['@_authorId'] ?? '');
                const author = authorMap.get(authorId) ?? 'Unknown';
                const text = cm['p:text'] ?? cm.text ?? '';
                if (text) {
                  mdContent += `- **${author}**: ${text}\n`;
                }
              }
            }
          }
        }
      }
    }

    return { markdown: mdContent.trimStart() };
  }

  private processShape(
    shape: any,
    titleShapeId: string | null,
    slideRelsMap: Map<string, { type: string; target: string }>,
    zip: any,
    opts: InternalConvertOptions,
  ): string {
    let md = '';

    // Check if this is a picture (p:pic)
    if (shape._type === 'pic') {
      const nvPicPr = shape['p:nvPicPr'] ?? shape.nvPicPr;
      const cNvPr = nvPicPr?.['p:cNvPr'] ?? nvPicPr?.cNvPr;
      let altText = cNvPr?.['@_descr'] ?? '';
      const shapeName = cNvPr?.['@_name'] ?? 'image';

      // Clean alt text
      altText = (altText || shapeName).replace(/[\r\n\[\]]/g, ' ').replace(/\s+/g, ' ').trim();

      if (opts.keepDataUris) {
        // We would need to read the image from zip, but for now use filename
        const filename = shapeName.replace(/\W/g, '') + '.jpg';
        md += `\n![${altText}](${filename})\n`;
      } else {
        const filename = shapeName.replace(/\W/g, '') + '.jpg';
        md += `\n![${altText}](${filename})\n`;
      }
      return md;
    }

    // Check if this is a text shape (p:sp)
    if (shape._type === 'sp') {
      const nvSpPr = shape['p:nvSpPr'] ?? shape.nvSpPr;
      const cNvPr = nvSpPr?.['p:cNvPr'] ?? nvSpPr?.cNvPr;
      const shapeId = cNvPr?.['@_id'] ? String(cNvPr['@_id']) : null;

      const txBody = shape['p:txBody'] ?? shape.txBody;
      if (txBody) {
        const text = this.extractTextFromTxBody(txBody);
        if (text) {
          if (shapeId && shapeId === titleShapeId) {
            md += '# ' + text.trimStart() + '\n';
          } else {
            md += text + '\n';
          }
        }
      }
      return md;
    }

    // Group shapes - process children recursively
    if (shape._type === 'grpSp') {
      const childShapes = this.collectShapesFromGroup(shape);
      const sorted = this.sortShapesByPosition(childShapes);
      for (const child of sorted) {
        md += this.processShape(child, titleShapeId, slideRelsMap, zip, opts);
      }
    }

    return md;
  }

  private async processGraphicFrame(
    frame: any,
    slideRelsMap: Map<string, { type: string; target: string }>,
    zip: any,
    opts: InternalConvertOptions,
  ): Promise<string> {
    let md = '';

    // Check for table
    const graphic = frame['a:graphic'] ?? frame.graphic;
    const graphicData = graphic?.['a:graphicData'] ?? graphic?.graphicData;

    if (graphicData) {
      // Table
      const tbl = graphicData['a:tbl'] ?? graphicData.tbl;
      if (tbl) {
        md += await this.convertTable(tbl, opts);
      }

      // Chart reference
      const chartRef = graphicData['c:chart'] ?? graphicData.chart;
      if (chartRef) {
        const rId = chartRef['@_r:id'] ?? chartRef['@_rId'];
        if (rId && slideRelsMap.has(rId)) {
          const rel = slideRelsMap.get(rId)!;
          if (rel.type === CHART_REL_TYPE || rel.target.includes('chart')) {
            // Resolve chart path relative to slide
            const chartPath = rel.target.startsWith('../')
              ? 'ppt/' + rel.target.slice(3)
              : rel.target;
            const chartXml = await this.readZipText(zip, chartPath);
            if (chartXml) {
              md += this.parseChart(chartXml);
            }
          }
        }
      }
    }

    return md;
  }

  private async convertTable(tbl: any, opts: InternalConvertOptions): Promise<string> {
    const rows = this.ensureArray(tbl['a:tr'] ?? tbl.tr);
    if (rows.length === 0) return '';

    let htmlTable = '<html><body><table>';
    let firstRow = true;

    for (const row of rows) {
      htmlTable += '<tr>';
      const cells = this.ensureArray(row['a:tc'] ?? row.tc);
      for (const cell of cells) {
        const text = this.extractTextFromTxBody(cell['a:txBody'] ?? cell.txBody);
        const escaped = this.escapeHtml(text);
        if (firstRow) {
          htmlTable += `<th>${escaped}</th>`;
        } else {
          htmlTable += `<td>${escaped}</td>`;
        }
      }
      htmlTable += '</tr>';
      firstRow = false;
    }

    htmlTable += '</table></body></html>';

    try {
      const result = await this.htmlConverter.convertHtml(htmlTable, opts.keepDataUris);
      return result.markdown.trim() + '\n';
    } catch {
      return '';
    }
  }

  private parseChart(chartXml: string): string {
    try {
      const doc = this.parser.parse(chartXml);
      const chartSpace = doc['c:chartSpace'] ?? doc.chartSpace ?? doc;
      const chart = chartSpace['c:chart'] ?? chartSpace.chart;
      if (!chart) return '\n\n[unsupported chart]\n\n';

      let md = '\n\n### Chart';

      // Chart title
      const titleNode = chart['c:title'] ?? chart.title;
      if (titleNode) {
        const titleText = this.extractChartTitleText(titleNode);
        if (titleText) md += `: ${titleText}`;
      }
      md += '\n\n';

      // Get plot area
      const plotArea = chart['c:plotArea'] ?? chart.plotArea;
      if (!plotArea) return md + '[unsupported chart]\n\n';

      // Find chart type (barChart, lineChart, pieChart, etc.)
      const chartTypes = ['barChart', 'lineChart', 'pieChart', 'areaChart', 'scatterChart', 'radarChart', 'doughnutChart'];
      let plotNode: any = null;
      for (const ct of chartTypes) {
        const nsKey = `c:${ct}`;
        if (plotArea[nsKey] ?? plotArea[ct]) {
          plotNode = plotArea[nsKey] ?? plotArea[ct];
          break;
        }
      }

      if (!plotNode) return md + '[unsupported chart]\n\n';

      // Extract series data
      const seriesList = this.ensureArray(plotNode['c:ser'] ?? plotNode.ser);
      if (seriesList.length === 0) return md + '[unsupported chart]\n\n';

      // Get category names from first series
      const firstSeries = seriesList[0];
      const catRef = firstSeries['c:cat'] ?? firstSeries.cat;
      const categoryNames = this.extractChartValues(catRef);

      // Get series names and values
      const seriesNames: string[] = [];
      const seriesData: (string | number)[][] = [];

      for (const ser of seriesList) {
        // Series name
        const tx = ser['c:tx'] ?? ser.tx;
        let serName = 'Series';
        if (tx) {
          const strRef = tx['c:strRef'] ?? tx.strRef;
          if (strRef) {
            const cache = strRef['c:strCache'] ?? strRef.strCache;
            if (cache) {
              const pts = this.ensureArray(cache['c:pt'] ?? cache.pt);
              if (pts.length > 0) {
                serName = pts[0]['c:v'] ?? pts[0].v ?? 'Series';
              }
            }
          }
        }
        seriesNames.push(String(serName));

        // Series values
        const valRef = ser['c:val'] ?? ser.val;
        seriesData.push(this.extractChartValues(valRef));
      }

      // Build markdown table
      const headerRow = ['Category', ...seriesNames];
      const dataRows: string[][] = [];

      for (let i = 0; i < categoryNames.length; i++) {
        const row = [String(categoryNames[i])];
        for (const series of seriesData) {
          row.push(String(series[i] ?? ''));
        }
        dataRows.push(row);
      }

      const rows = [headerRow, ...dataRows];
      const markdownTable: string[] = [];
      for (const row of rows) {
        markdownTable.push('| ' + row.join(' | ') + ' |');
      }

      const header = markdownTable[0];
      const separator = '|' + headerRow.map(() => '---').join('|') + '|';
      return md + [header, separator, ...markdownTable.slice(1)].join('\n');
    } catch {
      return '\n\n[unsupported chart]\n\n';
    }
  }

  private extractChartTitleText(titleNode: any): string {
    const tx = titleNode['c:tx'] ?? titleNode.tx;
    if (!tx) return '';
    const rich = tx['c:rich'] ?? tx.rich;
    if (!rich) return '';
    const paras = this.ensureArray(rich['a:p'] ?? rich.p);
    const parts: string[] = [];
    for (const p of paras) {
      const runs = this.ensureArray(p['a:r'] ?? p.r);
      for (const run of runs) {
        const t = run['a:t'] ?? run.t;
        if (t != null) parts.push(String(t));
      }
    }
    return parts.join('');
  }

  private extractChartValues(ref: any): (string | number)[] {
    if (!ref) return [];

    // Try numRef first
    const numRef = ref['c:numRef'] ?? ref.numRef ?? ref;
    const numCache = numRef['c:numCache'] ?? numRef.numCache;
    if (numCache) {
      const pts = this.ensureArray(numCache['c:pt'] ?? numCache.pt);
      const values: (string | number)[] = [];
      for (const pt of pts) {
        const v = pt['c:v'] ?? pt.v;
        values.push(v != null ? (isNaN(Number(v)) ? String(v) : Number(v)) : '');
      }
      return values;
    }

    // Try strRef
    const strRef = ref['c:strRef'] ?? ref.strRef ?? ref;
    const strCache = strRef['c:strCache'] ?? strRef.strCache;
    if (strCache) {
      const pts = this.ensureArray(strCache['c:pt'] ?? strCache.pt);
      return pts.map((pt: any) => {
        const v = pt['c:v'] ?? pt.v;
        return v != null ? String(v) : '';
      });
    }

    return [];
  }

  private findTitleShapeId(spTree: any): string | null {
    // Look through shapes for one with placeholder type "title" or "ctrTitle"
    const shapes = this.ensureArray(spTree['p:sp'] ?? spTree.sp);
    for (const sp of shapes) {
      const nvSpPr = sp['p:nvSpPr'] ?? sp.nvSpPr;
      if (!nvSpPr) continue;
      const nvPr = nvSpPr['p:nvPr'] ?? nvSpPr.nvPr;
      if (!nvPr) continue;
      const ph = nvPr['p:ph'] ?? nvPr.ph;
      if (!ph) continue;
      const phType = ph['@_type'];
      if (phType === 'title' || phType === 'ctrTitle') {
        const cNvPr = nvSpPr['p:cNvPr'] ?? nvSpPr.cNvPr;
        if (cNvPr?.['@_id']) return String(cNvPr['@_id']);
      }
    }
    return null;
  }

  private collectShapes(spTree: any): any[] {
    const shapes: any[] = [];

    // Text/title shapes
    const sps = this.ensureArray(spTree['p:sp'] ?? spTree.sp);
    for (const sp of sps) {
      shapes.push({ ...sp, _type: 'sp' });
    }

    // Picture shapes
    const pics = this.ensureArray(spTree['p:pic'] ?? spTree.pic);
    for (const pic of pics) {
      shapes.push({ ...pic, _type: 'pic' });
    }

    // Group shapes
    const grps = this.ensureArray(spTree['p:grpSp'] ?? spTree.grpSp);
    for (const grp of grps) {
      shapes.push({ ...grp, _type: 'grpSp' });
    }

    return shapes;
  }

  private collectGraphicFrames(spTree: any): any[] {
    return this.ensureArray(spTree['p:graphicFrame'] ?? spTree.graphicFrame);
  }

  private collectShapesFromGroup(grpSp: any): any[] {
    const shapes: any[] = [];

    const sps = this.ensureArray(grpSp['p:sp'] ?? grpSp.sp);
    for (const sp of sps) shapes.push({ ...sp, _type: 'sp' });

    const pics = this.ensureArray(grpSp['p:pic'] ?? grpSp.pic);
    for (const pic of pics) shapes.push({ ...pic, _type: 'pic' });

    const grps = this.ensureArray(grpSp['p:grpSp'] ?? grpSp.grpSp);
    for (const grp of grps) shapes.push({ ...grp, _type: 'grpSp' });

    return shapes;
  }

  private sortShapesByPosition(shapes: any[]): any[] {
    return shapes.sort((a, b) => {
      const aPos = this.getPosition(a);
      const bPos = this.getPosition(b);
      if (aPos.top !== bPos.top) return aPos.top - bPos.top;
      return aPos.left - bPos.left;
    });
  }

  private getPosition(shape: any): { top: number; left: number } {
    // Try spPr/xfrm first
    const spPr = shape['p:spPr'] ?? shape.spPr;
    if (spPr) {
      const xfrm = spPr['a:xfrm'] ?? spPr.xfrm;
      if (xfrm) {
        const off = xfrm['a:off'] ?? xfrm.off;
        if (off) {
          return {
            top: Number(off['@_y'] ?? 0),
            left: Number(off['@_x'] ?? 0),
          };
        }
      }
    }

    // Try grpSpPr for group shapes
    const grpSpPr = shape['p:grpSpPr'] ?? shape.grpSpPr;
    if (grpSpPr) {
      const xfrm = grpSpPr['a:xfrm'] ?? grpSpPr.xfrm;
      if (xfrm) {
        const off = xfrm['a:off'] ?? xfrm.off;
        if (off) {
          return {
            top: Number(off['@_y'] ?? 0),
            left: Number(off['@_x'] ?? 0),
          };
        }
      }
    }

    return { top: -Infinity, left: -Infinity };
  }

  private extractTextFromTxBody(txBody: any): string {
    if (!txBody) return '';

    const paragraphs = this.ensureArray(txBody['a:p'] ?? txBody.p);
    const parts: string[] = [];

    for (const p of paragraphs) {
      const runs = this.ensureArray(p['a:r'] ?? p.r);
      const paraText: string[] = [];
      for (const run of runs) {
        const t = run['a:t'] ?? run.t;
        if (t != null) paraText.push(String(t));
      }
      parts.push(paraText.join(''));
    }

    return parts.join('\n');
  }

  private extractNotesText(notesDoc: any): string | null {
    const notesSld = notesDoc['p:notes'] ?? notesDoc.notes ?? notesDoc;
    const cSld = notesSld['p:cSld'] ?? notesSld.cSld;
    if (!cSld) return null;

    const spTree = cSld['p:spTree'] ?? cSld.spTree;
    if (!spTree) return null;

    const shapes = this.ensureArray(spTree['p:sp'] ?? spTree.sp);
    for (const sp of shapes) {
      const nvSpPr = sp['p:nvSpPr'] ?? sp.nvSpPr;
      if (!nvSpPr) continue;
      const nvPr = nvSpPr['p:nvPr'] ?? nvSpPr.nvPr;
      if (!nvPr) continue;
      const ph = nvPr['p:ph'] ?? nvPr.ph;
      if (!ph) continue;
      const phType = ph['@_type'];
      if (phType === 'body') {
        const txBody = sp['p:txBody'] ?? sp.txBody;
        const text = this.extractTextFromTxBody(txBody);
        if (text.trim()) return text;
      }
    }

    return null;
  }

  private async readZipText(zip: any, path: string): Promise<string | null> {
    const file = zip.file(path);
    if (!file) return null;
    return file.async('string');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private ensureArray(value: unknown): any[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }
}
