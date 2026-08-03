import { ClipboardInput } from '../../types/common.js';
import { WindowsControlResponse } from '../../types/responses.js';
import { ClipboardAutomation } from '../../interfaces/automation.js';
/**
 * Keysender implementation of the ClipboardAutomation interface
 *
 * Note: Since keysender doesn't provide direct clipboard functionality,
 * we use the clipboardy library (same as the NutJS implementation)
 */
export declare class KeysenderClipboardAutomation implements ClipboardAutomation {
    getClipboardContent(): Promise<WindowsControlResponse>;
    setClipboardContent(input: ClipboardInput): Promise<WindowsControlResponse>;
    hasClipboardText(): Promise<WindowsControlResponse>;
    clearClipboard(): Promise<WindowsControlResponse>;
}
