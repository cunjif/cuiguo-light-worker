type KeyboardButtonType = string;
import { KeyboardInput, KeyCombination, KeyHoldOperation } from '../../types/common.js';
import { WindowsControlResponse } from '../../types/responses.js';
import { KeyboardAutomation } from '../../interfaces/automation.js';
/**
 * Keysender implementation of the KeyboardAutomation interface
 */
export declare class KeysenderKeyboardAutomation implements KeyboardAutomation {
    private keyboard;
    typeText(input: KeyboardInput): WindowsControlResponse;
    pressKey(key: string): WindowsControlResponse;
    _findMatchingString(A: KeyboardButtonType, ButtonList: KeyboardButtonType[]): KeyboardButtonType;
    pressKeyCombination(combination: KeyCombination): Promise<WindowsControlResponse>;
    holdKey(operation: KeyHoldOperation): Promise<WindowsControlResponse>;
}
export {};
