import { Math } from 'docx';
/**
 * 数学公式组件接口
 */
export interface MathComponent {
    type: 'run' | 'fraction' | 'radical' | 'superscript' | 'subscript' | 'subsuperscript' | 'sum' | 'limit-upper' | 'limit-lower' | 'function' | 'square-brackets' | 'round-brackets' | 'curly-brackets' | 'angled-brackets' | 'text';
    content?: string;
    children?: MathComponent[];
    numerator?: MathComponent[];
    denominator?: MathComponent[];
    degree?: MathComponent[];
    superScript?: MathComponent[];
    subScript?: MathComponent[];
    name?: string;
    limit?: MathComponent[];
}
/**
 * 数学公式配置接口
 */
export interface MathConfig {
    inline?: boolean;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
}
/**
 * LaTeX数学公式解析器
 * 将LaTeX数学表达式解析为AST结构
 */
export declare class MathParser {
    private position;
    private text;
    /**
     * 解析LaTeX数学表达式
     */
    parse(latex: string): MathComponent[];
    private parseComponent;
    private parseCommand;
    private parseWord;
    private parseGroup;
    private parseSuperscript;
    private parseSubscript;
    private parseFraction;
    private parseFractionCommand;
    private parseSqrtCommand;
    private parseSumCommand;
    private parseIntegralCommand;
    private parseLimitCommand;
    private parseFunctionCommand;
    private parseRadical;
    private parseSum;
    private parseIntegral;
    private parseSymbol;
    private parseText;
    private skipWhitespace;
    private componentToString;
}
/**
 * docx数学组件转换器
 * 将数学组件AST转换为docx数学对象
 */
export declare class MathConverter {
    /**
     * 将数学组件数组转换为docx数学对象数组
     */
    static convertComponents(components: MathComponent[], config?: MathConfig): any[];
    /**
     * 将单个数学组件转换为docx数学对象
     */
    static convertComponent(component: MathComponent, config?: MathConfig): any | null;
    /**
     * 创建数学文本运行对象
     */
    private static createMathRun;
}
/**
 * 数学公式处理器主类
 */
export declare class MathProcessor {
    private parser;
    constructor();
    /**
     * 处理Markdown数学公式文本
     * 支持行内公式 $...$ 和行间公式 $$...$$
     */
    processMathInMarkdown(markdown: string): {
        processed: string;
        mathBlocks: Array<{
            latex: string;
            startIndex: number;
            endIndex: number;
            inline: boolean;
        }>;
    };
    /**
     * 将LaTeX数学公式转换为docx数学对象
     */
    convertLatexToDocx(latex: string, config?: MathConfig): Math | null;
    /**
     * 检查文本是否包含数学公式
     */
    containsMath(text: string): boolean;
    /**
     * 提取文本中的数学公式
     */
    extractMathExpressions(text: string): Array<{
        expression: string;
        start: number;
        end: number;
        type: 'inline' | 'block';
    }>;
}
//# sourceMappingURL=mathProcessor.d.ts.map