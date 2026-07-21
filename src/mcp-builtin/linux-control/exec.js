import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function run(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    return { success: true, data: stdout.trim() };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

export async function runQuiet(cmd) {
  try {
    await execAsync(cmd, { timeout: 10000 });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}