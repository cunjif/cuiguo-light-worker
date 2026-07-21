import { run, runQuiet } from './exec.js';

export async function getClipboardContent() {
  const result = await run('xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null');
  if (!result.success) return { success: false, error: result.message };
  return { success: true, content: result.data };
}

export async function setClipboardContent(input) {
  if (!input.text) return { success: false, error: 'Text is required' };
  const escaped = input.text.replace(/'/g, "'\\''");
  const result = await runQuiet(`echo -n '${escaped}' | xclip -selection clipboard 2>/dev/null || echo -n '${escaped}' | xsel --clipboard --input 2>/dev/null`);
  if (!result.success) return { success: false, error: result.message };
  return { success: true };
}

export async function hasClipboardText() {
  const result = await getClipboardContent();
  if (!result.success) return { success: false, error: result.error };
  return { success: true, hasText: result.content.length > 0 };
}

export async function clearClipboard() {
  const result = await runQuiet(`xclip -selection clipboard /dev/null 2>/dev/null || xsel --clipboard --clear 2>/dev/null`);
  if (!result.success) return { success: false, error: result.message };
  return { success: true };
}