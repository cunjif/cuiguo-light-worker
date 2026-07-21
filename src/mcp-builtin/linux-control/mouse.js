import { run, runQuiet } from './exec.js';

const BUTTON_MAP = { left: 1, middle: 2, right: 3 };

function toButton(b) {
  return BUTTON_MAP[b] || BUTTON_MAP.left;
}

export async function moveMouse(position) {
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    return { success: false, message: 'Invalid position' };
  }
  const result = await runQuiet(`xdotool mousemove ${position.x} ${position.y}`);
  if (!result.success) return result;
  return { success: true };
}

export async function clickMouse(button = 'left') {
  const b = toButton(button);
  const result = await runQuiet(`xdotool click ${b}`);
  if (!result.success) return result;
  return { success: true };
}

export async function doubleClick(position) {
  if (position && typeof position.x === 'number' && typeof position.y === 'number') {
    const moveResult = await runQuiet(`xdotool mousemove ${position.x} ${position.y}`);
    if (!moveResult.success) return moveResult;
  }
  const b = toButton('left');
  const result = await runQuiet(`xdotool click --repeat 2 --delay 100 ${b}`);
  if (!result.success) return result;
  return { success: true };
}

export async function getCursorPosition() {
  const result = await run('xdotool getmouselocation --shell');
  if (!result.success) return result;
  const lines = result.data.split('\n');
  const data = {};
  for (const line of lines) {
    const [k, v] = line.split('=');
    if (k && v) data[k] = parseInt(v, 10);
  }
  return { success: true, data: { x: data.X, y: data.Y } };
}

export async function scrollMouse(amount) {
  const button = amount > 0 ? 5 : 4;
  const clicks = Math.abs(amount);
  const result = await runQuiet(`xdotool click --repeat ${clicks} --delay 50 ${button}`);
  if (!result.success) return result;
  return { success: true };
}

export async function dragMouse(from, to, button = 'left') {
  const b = toButton(button);
  const moveResult = await runQuiet(`xdotool mousemove ${from.x} ${from.y}`);
  if (!moveResult.success) return moveResult;
  const downResult = await runQuiet(`xdotool mousedown ${b}`);
  if (!downResult.success) return downResult;
  await new Promise(r => setTimeout(r, 50));
  const toResult = await runQuiet(`xdotool mousemove ${to.x} ${to.y}`);
  if (!toResult.success) return toResult;
  await new Promise(r => setTimeout(r, 50));
  const upResult = await runQuiet(`xdotool mouseup ${b}`);
  if (!upResult.success) return upResult;
  return { success: true };
}

export async function clickAt(x, y, button = 'left') {
  const b = toButton(button);
  const result = await runQuiet(`xdotool mousemove ${x} ${y} click ${b}`);
  if (!result.success) return result;
  return { success: true };
}