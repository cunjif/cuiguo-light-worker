import { StyleConfig, TemplateProcessor } from '../types/template.js';
declare type Buffer = any;
export declare class DocxTemplateProcessor implements TemplateProcessor {
    extractStyles(template: Buffer): Promise<StyleConfig>;
}
export {};
//# sourceMappingURL=processor.d.ts.map