export type SkillCategory =
  | 'document'
  | 'analysis'
  | 'development'
  | 'design'
  | 'workflow'
  | 'custom';

export interface SkillTrigger {
  type: 'keyword' | 'intent' | 'regex' | 'manual';
  value: string;
  priority: number;
}

export interface ToolChain {
  step: number;
  server: string;
  tool: string;
  inputMapping: Record<string, string>;
  outputKey?: string;
}

export interface SkillManifest {
  name: string;
  version: string;
  displayName: { zh: string; en: string };
  description: { zh: string; en: string };
  icon: string;
  category: SkillCategory;
  tags: string[];
  author: string;
  triggers: SkillTrigger[];
  requiredServers?: string[];
  optionalServers?: string[];
  systemPrompt: string;
  userPromptTemplate?: string;
  toolChains?: ToolChain[];
  configSchema?: Record<string, any>;
  defaultConfig?: Record<string, any>;
}

export interface InstalledSkill {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  installedAt: string;
  lastUsedAt?: string;
  usageCount: number;
}

export interface SkillRegistryIndex {
  version: string;
  skills: SkillManifest[];
}