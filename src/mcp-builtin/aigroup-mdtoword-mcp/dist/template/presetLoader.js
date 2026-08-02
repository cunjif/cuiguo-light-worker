/**
 * 静态预设模板配置 - 避免文件系统操作，提升无服务器环境性能
 */
const STATIC_PRESET_TEMPLATES = {
    'customer-analysis': {
        name: '客户分析模板',
        description: '专为客户分析报告设计的模板，包含完整的样式配置',
        category: 'business',
        styleConfig: {
            document: {
                defaultFont: '宋体',
                defaultSize: 24,
                defaultColor: '000000',
                page: {
                    size: 'A4',
                    orientation: 'portrait',
                    margins: {
                        top: 1440,
                        bottom: 1440,
                        left: 1440,
                        right: 1440
                    }
                }
            },
            headingStyles: {
                h1: {
                    name: '大标题',
                    level: 1,
                    font: '黑体',
                    size: 64,
                    color: '000000',
                    bold: true,
                    alignment: 'center',
                    spacing: {
                        before: 240,
                        after: 120
                    }
                },
                h2: {
                    name: '一级标题',
                    level: 2,
                    font: '黑体',
                    size: 32,
                    color: '000000',
                    bold: true,
                    spacing: {
                        before: 240,
                        after: 120
                    }
                }
            },
            paragraphStyles: {
                normal: {
                    name: '正文',
                    font: '宋体',
                    size: 24,
                    color: '000000',
                    alignment: 'justify',
                    spacing: {
                        line: 360,
                        lineRule: 'auto'
                    },
                    indent: {
                        firstLine: 480
                    }
                }
            }
        }
    },
    'academic': {
        name: '学术论文模板',
        description: '适用于学术论文的专业模板',
        category: 'academic',
        styleConfig: {
            document: {
                defaultFont: 'Times New Roman',
                defaultSize: 24,
                defaultColor: '000000',
                page: {
                    size: 'A4',
                    orientation: 'portrait',
                    margins: {
                        top: 1440,
                        bottom: 1440,
                        left: 1800,
                        right: 1440
                    }
                }
            },
            headingStyles: {
                h1: {
                    level: 1,
                    font: 'Times New Roman',
                    size: 32,
                    color: '000000',
                    bold: true,
                    alignment: 'center',
                    spacing: {
                        before: 480,
                        after: 240
                    }
                },
                h2: {
                    level: 2,
                    font: 'Times New Roman',
                    size: 28,
                    color: '000000',
                    bold: true,
                    spacing: {
                        before: 360,
                        after: 180
                    }
                }
            },
            paragraphStyles: {
                normal: {
                    font: 'Times New Roman',
                    size: 24,
                    color: '000000',
                    alignment: 'justify',
                    spacing: {
                        line: 432,
                        lineRule: 'auto'
                    },
                    indent: {
                        firstLine: 720
                    }
                }
            }
        }
    },
    'business': {
        name: '商务报告模板',
        description: '适用于商务报告的专业模板',
        category: 'business',
        styleConfig: {
            document: {
                defaultFont: '微软雅黑',
                defaultSize: 24,
                defaultColor: '333333',
                page: {
                    size: 'A4',
                    orientation: 'portrait',
                    margins: {
                        top: 1440,
                        bottom: 1440,
                        left: 1440,
                        right: 1440
                    }
                }
            },
            headingStyles: {
                h1: {
                    level: 1,
                    font: '微软雅黑',
                    size: 36,
                    color: '2E74B5',
                    bold: true,
                    alignment: 'left',
                    spacing: {
                        before: 360,
                        after: 180
                    }
                },
                h2: {
                    level: 2,
                    font: '微软雅黑',
                    size: 30,
                    color: '2E74B5',
                    bold: true,
                    spacing: {
                        before: 240,
                        after: 120
                    }
                }
            },
            paragraphStyles: {
                normal: {
                    font: '微软雅黑',
                    size: 24,
                    color: '333333',
                    alignment: 'justify',
                    spacing: {
                        line: 360,
                        lineRule: 'auto'
                    }
                }
            }
        }
    },
    'technical': {
        name: '技术文档模板',
        description: '适用于技术文档的模板',
        category: 'technical',
        styleConfig: {
            document: {
                defaultFont: 'Calibri',
                defaultSize: 22,
                defaultColor: '000000',
                page: {
                    size: 'A4',
                    orientation: 'portrait',
                    margins: {
                        top: 1440,
                        bottom: 1440,
                        left: 1440,
                        right: 1440
                    }
                }
            },
            headingStyles: {
                h1: {
                    level: 1,
                    font: 'Calibri',
                    size: 32,
                    color: '1F4E79',
                    bold: true,
                    spacing: {
                        before: 240,
                        after: 120
                    }
                },
                h2: {
                    level: 2,
                    font: 'Calibri',
                    size: 28,
                    color: '1F4E79',
                    bold: true,
                    spacing: {
                        before: 180,
                        after: 90
                    }
                }
            },
            paragraphStyles: {
                normal: {
                    font: 'Calibri',
                    size: 22,
                    color: '000000',
                    alignment: 'left',
                    spacing: {
                        line: 330,
                        lineRule: 'auto'
                    }
                }
            },
            codeBlockStyle: {
                font: 'Consolas',
                size: 20,
                color: '000000',
                backgroundColor: 'F8F8F8'
            }
        }
    },
    'minimal': {
        name: '简约模板',
        description: '简洁的文档模板',
        category: 'minimal',
        styleConfig: {
            document: {
                defaultFont: 'Arial',
                defaultSize: 24,
                defaultColor: '000000',
                page: {
                    size: 'A4',
                    orientation: 'portrait',
                    margins: {
                        top: 1440,
                        bottom: 1440,
                        left: 1440,
                        right: 1440
                    }
                }
            },
            headingStyles: {
                h1: {
                    level: 1,
                    font: 'Arial',
                    size: 32,
                    color: '000000',
                    bold: true,
                    spacing: {
                        before: 240,
                        after: 120
                    }
                },
                h2: {
                    level: 2,
                    font: 'Arial',
                    size: 28,
                    color: '000000',
                    bold: true,
                    spacing: {
                        before: 180,
                        after: 90
                    }
                }
            },
            paragraphStyles: {
                normal: {
                    font: 'Arial',
                    size: 24,
                    color: '000000',
                    alignment: 'left',
                    spacing: {
                        line: 360,
                        lineRule: 'auto'
                    }
                }
            }
        }
    }
};
/**
 * 优化的预设模板加载器 - 无文件系统操作，适用于无服务器环境
 */
export class PresetTemplateLoader {
    templates = new Map();
    defaultTemplateId = 'customer-analysis';
    constructor() {
        const constructorStartTime = Date.now();
        console.log(`🚀 [模板加载器] 开始初始化（静态模式） - ${new Date().toISOString()}`);
        // 直接从静态配置加载，无文件系统操作
        this.loadStaticTemplates();
        const constructorTime = Date.now() - constructorStartTime;
        console.log(`🏁 [模板加载器] 初始化完成，总耗时: ${constructorTime}ms`);
    }
    /**
     * 从静态配置加载模板 - 零文件系统操作
     */
    loadStaticTemplates() {
        const loadStartTime = Date.now();
        // 直接从内存中的静态配置加载
        for (const [templateId, template] of Object.entries(STATIC_PRESET_TEMPLATES)) {
            this.templates.set(templateId, template);
        }
        const loadTime = Date.now() - loadStartTime;
        console.log(`⚡ [模板加载器] 静态模板加载完成，共 ${this.templates.size} 个模板，耗时: ${loadTime}ms`);
        console.log(`✅ 默认模板: ${this.defaultTemplateId}`);
        // 列出所有可用模板
        const templateList = Array.from(this.templates.keys());
        console.log(`📋 可用模板: ${templateList.join(', ')}`);
    }
    /**
     * 获取所有预设模板
     */
    getPresetTemplates() {
        return new Map(this.templates);
    }
    /**
     * 根据ID获取预设模板
     */
    getPresetTemplate(id) {
        const getStartTime = Date.now();
        const template = this.templates.get(id);
        const getTime = Date.now() - getStartTime;
        console.log(`⚡ [模板加载器] 获取模板 ${id} 耗时: ${getTime}ms`);
        return template;
    }
    /**
     * 获取默认模板
     */
    getDefaultTemplate() {
        const getStartTime = Date.now();
        const template = this.templates.get(this.defaultTemplateId);
        const getTime = Date.now() - getStartTime;
        console.log(`⚡ [模板加载器] 获取默认模板耗时: ${getTime}ms`);
        return template;
    }
    /**
     * 获取默认模板的样式配置
     */
    getDefaultStyleConfig() {
        const defaultTemplate = this.getDefaultTemplate();
        return defaultTemplate?.styleConfig;
    }
    /**
     * 获取默认模板ID
     */
    getDefaultTemplateId() {
        return this.defaultTemplateId;
    }
    /**
     * 检查模板是否存在
     */
    hasTemplate(id) {
        return this.templates.has(id);
    }
    /**
     * 获取模板列表（用于API返回）
     */
    getTemplateList() {
        return Array.from(this.templates.entries()).map(([id, template]) => ({
            id,
            name: template.name,
            description: template.description,
            category: template.category,
            isDefault: id === this.defaultTemplateId
        }));
    }
    /**
     * 重新加载模板（静态模式下实际上是重新初始化）
     */
    reload() {
        console.log(`🔄 [模板加载器] 重新加载模板`);
        this.templates.clear();
        this.loadStaticTemplates();
    }
}
/**
 * 全局预设模板加载器实例
 */
export const presetTemplateLoader = new PresetTemplateLoader();
//# sourceMappingURL=presetLoader.js.map