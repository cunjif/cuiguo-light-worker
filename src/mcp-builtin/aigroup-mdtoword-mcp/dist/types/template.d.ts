export interface Template {
    id: string;
    name: string;
    description: string;
    category?: string;
    isDefault: boolean;
    styleConfig: import('./style.js').StyleConfig;
}
export interface PresetTemplate extends Template {
    type: 'preset';
}
export type StyleConfig = import('./style.js').StyleConfig;
export type ParagraphStyle = import('./style.js').ParagraphStyle;
export type TextStyle = import('./style.js').TextStyle;
export type HeadingStyle = import('./style.js').HeadingStyle;
export type ListStyle = import('./style.js').ListStyle;
export type TableStyle = import('./style.js').TableStyle;
export type BorderStyle = import('./style.js').BorderStyle;
export type CodeBlockStyle = import('./style.js').CodeBlockStyle;
export type BlockquoteStyle = import('./style.js').BlockquoteStyle;
export type CharacterStyle = import('./style.js').TextStyle;
export interface LegacyStyleConfig {
    paragraphStyles: {
        [key: string]: LegacyParagraphStyle;
    };
    characterStyles: {
        [key: string]: LegacyCharacterStyle;
    };
    tableStyles: {
        [key: string]: LegacyTableStyle;
    };
    listStyles: {
        [key: string]: LegacyListStyle;
    };
}
export interface LegacyParagraphStyle {
    name: string;
    font?: string;
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    spacing?: {
        before?: number;
        after?: number;
        line?: number;
    };
    indent?: {
        left?: number;
        right?: number;
        firstLine?: number;
    };
}
export interface LegacyCharacterStyle {
    name: string;
    font?: string;
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}
export interface LegacyTableStyle {
    name: string;
    borders?: {
        top?: LegacyBorderStyle;
        bottom?: LegacyBorderStyle;
        left?: LegacyBorderStyle;
        right?: LegacyBorderStyle;
        insideH?: LegacyBorderStyle;
        insideV?: LegacyBorderStyle;
    };
    cellMargin?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
    alignment?: 'left' | 'center' | 'right';
}
export interface LegacyListStyle {
    name: string;
    type: 'bullet' | 'number';
    format?: string;
    indent?: number;
    start?: number;
}
export interface LegacyBorderStyle {
    size: number;
    color: string;
    style: 'single' | 'double' | 'dash' | 'none';
}
export interface TemplateProcessor {
    extractStyles(template: Buffer): Promise<StyleConfig>;
}
//# sourceMappingURL=template.d.ts.map