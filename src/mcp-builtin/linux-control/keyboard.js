import { run, runQuiet } from './exec.js';

const KEY_MAP = {
  enter: 'Return', return: 'Return',
  tab: 'Tab', escape: 'Escape', esc: 'Escape',
  backspace: 'BackSpace', delete: 'Delete',
  home: 'Home', end: 'End',
  pageup: 'Page_Up', pagedown: 'Page_Down',
  space: 'space',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4',
  f5: 'F5', f6: 'F6', f7: 'F7', f8: 'F8',
  f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
  shift: 'Shift_L', ctrl: 'Control_L', alt: 'Alt_L',
  super: 'Super_L', meta: 'Super_L',
  capslock: 'Caps_Lock', numlock: 'Num_Lock',
  insert: 'Insert', printscreen: 'Print',
  scrolllock: 'Scroll_Lock', pause: 'Pause',
};

function toXdotoolKey(key) {
  const lower = key.toLowerCase();
  if (KEY_MAP[lower]) return KEY_MAP[lower];
  if (key.length === 1) return key;
  return key;
}

export async function typeText(input) {
  if (!input.text) {
    return { success: false, message: 'Text is required' };
  }
  const escaped = input.text.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
  const result = await run(`xdotool type --delay 12 '${escaped}'`);
  if (!result.success) return result;
  return { success: true };
}

export async function pressKey(key) {
  const xkey = toXdotoolKey(key);
  const result = await runQuiet(`xdotool key ${xkey}`);
  if (!result.success) return result;
  return { success: true };
}

export async function pressKeyCombination(combination) {
  if (!combination.keys || !Array.isArray(combination.keys) || combination.keys.length === 0) {
    return { success: false, message: 'Keys array is required' };
  }
  const xkeys = combination.keys.map(toXdotoolKey).join('+');
  const result = await runQuiet(`xdotool key ${xkeys}`);
  if (!result.success) return result;
  return { success: true };
}

export async function holdKey(operation) {
  const xkey = toXdotoolKey(operation.key);
  if (operation.state === 'down') {
    const result = await runQuiet(`xdotool keydown ${xkey}`);
    if (!result.success) return result;
    if (operation.duration && operation.duration > 0) {
      await new Promise(r => setTimeout(r, operation.duration));
      const upResult = await runQuiet(`xdotool keyup ${xkey}`);
      if (!upResult.success) return upResult;
    }
    return { success: true };
  } else {
    const result = await runQuiet(`xdotool keyup ${xkey}`);
    if (!result.success) return result;
    return { success: true };
  }
}