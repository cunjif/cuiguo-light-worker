import { AutomationProvider } from '../../interfaces/provider.js';
import { KeyboardAutomation, MouseAutomation, ScreenAutomation, ClipboardAutomation } from '../../interfaces/automation.js';
/**
 * Keysender implementation of the AutomationProvider
 *
 * NOTE: This provider requires the Windows operating system to compile native dependencies.
 * Building this module on non-Windows platforms will fail.
 * Development requires:
 * - Node.js installed via the official Windows installer (includes necessary build tools)
 * - node-gyp installed globally (npm install -g node-gyp)
 * - cmake-js installed globally (npm install -g cmake-js)
 */
export declare class KeysenderProvider implements AutomationProvider {
    keyboard: KeyboardAutomation;
    mouse: MouseAutomation;
    screen: ScreenAutomation;
    clipboard: ClipboardAutomation;
    constructor();
}
