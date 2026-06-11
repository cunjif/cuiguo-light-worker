import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extractZip } from '../../lib/repo/extract_zip.js';
import type { SkillManifest, InstalledSkill, SkillRegistryIndex, SkillTrigger } from './types.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const registryPath = join(__dirname, 'registry.json');

function readRegistry(): SkillRegistryIndex {
  try {
    const data = readFileSync(registryPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading skills registry:', error);
    return { version: '1.0.0', skills: [] };
  }
}

export function listRegistrySkills(): SkillManifest[] {
  const registry = readRegistry();
  return registry.skills;
}

export function installSkill(name: string, currentInstalled: InstalledSkill[]): {
  success: boolean;
  message: string;
  installedSkills?: InstalledSkill[];
} {
  const registry = readRegistry();
  const manifest = registry.skills.find(s => s.name === name);

  if (!manifest) {
    return { success: false, message: `Skill "${name}" not found in registry` };
  }

  if (currentInstalled.some(s => s.name === name)) {
    return { success: false, message: `Skill "${name}" is already installed` };
  }

  const newInstalled: InstalledSkill = {
    name: manifest.name,
    enabled: true,
    config: manifest.defaultConfig ? JSON.parse(JSON.stringify(manifest.defaultConfig)) : {},
    installedAt: new Date().toISOString(),
    usageCount: 0,
  };

  const updated = [...currentInstalled, newInstalled];
  console.log(`Skill "${name}" installed successfully`);
  return { success: true, message: `Skill "${name}" installed successfully`, installedSkills: updated };
}

export function uninstallSkill(name: string, currentInstalled: InstalledSkill[]): {
  success: boolean;
  message: string;
  installedSkills?: InstalledSkill[];
} {
  const index = currentInstalled.findIndex(s => s.name === name);

  if (index === -1) {
    return { success: false, message: `Skill "${name}" is not installed` };
  }

  const updated = currentInstalled.filter(s => s.name !== name);
  console.log(`Skill "${name}" uninstalled successfully`);
  return { success: true, message: `Skill "${name}" uninstalled successfully`, installedSkills: updated };
}

export function toggleSkill(name: string, enabled: boolean, currentInstalled: InstalledSkill[]): {
  success: boolean;
  message: string;
  installedSkills?: InstalledSkill[];
} {
  const skill = currentInstalled.find(s => s.name === name);

  if (!skill) {
    return { success: false, message: `Skill "${name}" is not installed` };
  }

  skill.enabled = enabled;
  console.log(`Skill "${name}" ${enabled ? 'enabled' : 'disabled'}`);
  return { success: true, message: `Skill "${name}" ${enabled ? 'enabled' : 'disabled'}`, installedSkills: [...currentInstalled] };
}

export function updateSkillConfig(name: string, config: Record<string, any>, currentInstalled: InstalledSkill[]): {
  success: boolean;
  message: string;
  installedSkills?: InstalledSkill[];
} {
  const skill = currentInstalled.find(s => s.name === name);

  if (!skill) {
    return { success: false, message: `Skill "${name}" is not installed` };
  }

  skill.config = { ...skill.config, ...config };
  return { success: true, message: `Skill "${name}" config updated`, installedSkills: [...currentInstalled] };
}

export function getSkillManifest(name: string): SkillManifest | null {
  const registry = readRegistry();
  return registry.skills.find(s => s.name === name) || null;
}

export function matchSkill(userInput: string, currentInstalled: InstalledSkill[]): SkillManifest | null {
  const enabledSkills = currentInstalled.filter(s => s.enabled);

  if (enabledSkills.length === 0) {
    return null;
  }

  const registry = readRegistry();
  const inputLower = userInput.toLowerCase();

  let bestMatch: SkillManifest | null = null;
  let bestPriority = 0;

  for (const installedSkill of enabledSkills) {
    const manifest = registry.skills.find(s => s.name === installedSkill.name);
    if (!manifest || !manifest.triggers) continue;

    for (const trigger of manifest.triggers) {
      if (trigger.type === 'keyword') {
        const keywords = trigger.value.split('|');
        const matched = keywords.some(kw => inputLower.includes(kw.toLowerCase().trim()));
        if (matched && trigger.priority > bestPriority) {
          bestPriority = trigger.priority;
          bestMatch = manifest;
        }
      } else if (trigger.type === 'regex') {
        try {
          const regex = new RegExp(trigger.value, 'i');
          if (regex.test(userInput) && trigger.priority > bestPriority) {
            bestPriority = trigger.priority;
            bestMatch = manifest;
          }
        } catch {
          // invalid regex, skip
        }
      }
    }
  }

  return bestMatch;
}

export function recordSkillUsage(name: string, currentInstalled: InstalledSkill[]): InstalledSkill[] {
  const skill = currentInstalled.find(s => s.name === name);
  if (!skill) return currentInstalled;

  skill.usageCount++;
  skill.lastUsedAt = new Date().toISOString();
  return [...currentInstalled];
}

export function getSkillSystemPrompt(name: string, currentInstalled: InstalledSkill[]): string | null {
  const manifest = getSkillManifest(name);
  if (!manifest) return null;

  const skill = currentInstalled.find(s => s.name === name);

  let prompt = manifest.systemPrompt;

  if (skill?.config && Object.keys(skill.config).length > 0) {
    prompt += `\n\n当前技能配置: ${JSON.stringify(skill.config, null, 2)}`;
  }

  return prompt;
}

export function importSkill(manifestJson: string): { success: boolean; message: string } {
  try {
    const manifest: SkillManifest = JSON.parse(manifestJson);

    if (!manifest.name || !manifest.version || !manifest.systemPrompt) {
      return { success: false, message: 'Invalid skill manifest: missing required fields' };
    }

    const registry = readRegistry();
    const existingIndex = registry.skills.findIndex(s => s.name === manifest.name);

    if (existingIndex !== -1) {
      registry.skills[existingIndex] = manifest;
    } else {
      registry.skills.push(manifest);
    }

    try {
      writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
      return { success: true, message: `Skill "${manifest.name}" imported successfully` };
    } catch (error: any) {
      return { success: false, message: `Failed to save imported skill: ${error.message}` };
    }
  } catch (error: any) {
    return { success: false, message: `Invalid JSON: ${error.message}` };
  }
}

export function exportSkill(name: string): string | null {
  const manifest = getSkillManifest(name);
  if (!manifest) return null;
  return JSON.stringify(manifest, null, 2);
}

export interface SkillPackManifest {
  name: string;
  version: string;
  author: string;
  description?: string;
  skills: SkillManifest[];
}

export async function importSkillPack(skillPackPath: string): Promise<{
  success: boolean;
  message: string;
  importedCount?: number;
  skillNames?: string[];
}> {
  let tempExtractDir = '';

  try {
    if (!existsSync(skillPackPath)) {
      return { success: false, message: `Skill pack file not found: ${skillPackPath}` };
    }

    const ext = skillPackPath.toLowerCase();
    if (!ext.endsWith('.skill') && !ext.endsWith('.zip')) {
      return { success: false, message: 'File must have .skill or .zip extension' };
    }

    tempExtractDir = join(tmpdir(), `skill-pack-${Date.now()}`);
    mkdirSync(tempExtractDir, { recursive: true });

    console.log(`Extracting skill pack from ${skillPackPath} to ${tempExtractDir}`);
    await extractZip(skillPackPath, tempExtractDir);

    let manifestPath = join(tempExtractDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      const entries: string[] = readdirSync(tempExtractDir) as string[];
      const subDir = entries.find((e: string) => {
        const subPath = join(tempExtractDir, e);
        try {
          return existsSync(join(subPath, 'manifest.json'));
        } catch { return false; }
      });
      if (subDir !== undefined) {
        manifestPath = join(tempExtractDir, subDir, 'manifest.json');
      } else {
        return { success: false, message: 'No manifest.json found in skill pack. A valid .skill package must contain manifest.json at the root.' };
      }
    }

    const manifestData = readFileSync(manifestPath, 'utf8');
    const packManifest: SkillPackManifest = JSON.parse(manifestData);

    if (!packManifest.name || !packManifest.version || !Array.isArray(packManifest.skills) || packManifest.skills.length === 0) {
      return { success: false, message: 'Invalid skill pack manifest: must contain name, version, and a non-empty skills array' };
    }

    for (const skill of packManifest.skills) {
      if (!skill.name || !skill.version || !skill.systemPrompt) {
        return { success: false, message: `Invalid skill in pack: "${skill.name || 'unnamed'}" is missing required fields (name, version, systemPrompt)` };
      }
    }

    const registry = readRegistry();
    const importedNames: string[] = [];

    for (const skill of packManifest.skills) {
      const existingIndex = registry.skills.findIndex(s => s.name === skill.name);
      if (existingIndex !== -1) {
        registry.skills[existingIndex] = skill;
        console.log(`Updated existing skill: ${skill.name}`);
      } else {
        registry.skills.push(skill);
        console.log(`Added new skill: ${skill.name}`);
      }
      importedNames.push(skill.name);
    }

    writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');

    console.log(`Skill pack "${packManifest.name}" imported: ${importedNames.length} skills`);

    return {
      success: true,
      message: `Skill pack "${packManifest.name}" imported successfully: ${importedNames.length} skills (${importedNames.join(', ')})`,
      importedCount: importedNames.length,
      skillNames: importedNames,
    };
  } catch (error: any) {
    console.error('Error importing skill pack:', error);
    return { success: false, message: `Failed to import skill pack: ${error.message}` };
  } finally {
    if (tempExtractDir && existsSync(tempExtractDir)) {
      try {
        rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (cleanupError: any) {
        console.warn('Failed to clean up temp directory:', cleanupError.message);
      }
    }
  }
}

export async function exportSkillPack(skillNames: string[]): Promise<{
  success: boolean;
  message: string;
  filePath?: string;
}> {
  if (!skillNames || skillNames.length === 0) {
    return { success: false, message: 'No skills selected for export' };
  }

  let tempWorkDir = '';

  try {
    const registry = readRegistry();
    const skillsToExport = skillNames
      .map(name => registry.skills.find(s => s.name === name))
      .filter((s): s is SkillManifest => s !== undefined);

    if (skillsToExport.length === 0) {
      return { success: false, message: 'No valid skills found for export' };
    }

    const packManifest = {
      name: `${skillsToExport[0].name}-pack`,
      version: '1.0.0',
      author: 'user',
      description: `Skill pack with ${skillsToExport.length} skill(s)`,
      skills: skillsToExport,
    };

    tempWorkDir = join(tmpdir(), `skill-export-${Date.now()}`);
    mkdirSync(tempWorkDir, { recursive: true });

    const manifestPath = join(tempWorkDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(packManifest, null, 2), 'utf8');

    const outputFileName = `${packManifest.name}.skill`;
    const outputPath = join(tmpdir(), outputFileName);

    if (existsSync(outputPath)) {
      rmSync(outputPath, { force: true });
    }

    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const src = tempWorkDir;
      const command = `powershell -Command "Compress-Archive -Path '${src}${sep}*' -DestinationPath '${outputPath}' -Force"`;
      await execAsync(command);
    } else {
      const command = `cd "${tempWorkDir}" && zip -r "${outputPath}" .`;
      await execAsync(command);
    }

    console.log(`Skill pack exported to: ${outputPath}`);

    return {
      success: true,
      message: `Skill pack exported: ${skillsToExport.length} skill(s)`,
      filePath: outputPath,
    };
  } catch (error: any) {
    console.error('Error exporting skill pack:', error);
    return { success: false, message: `Failed to export skill pack: ${error.message}` };
  } finally {
    if (tempWorkDir && existsSync(tempWorkDir)) {
      try {
        rmSync(tempWorkDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
