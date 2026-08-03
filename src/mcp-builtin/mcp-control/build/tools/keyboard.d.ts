import { KeyboardInput, KeyCombination, KeyHoldOperation } from '../types/common.js';
import { WindowsControlResponse } from '../types/responses.js';
export declare function typeText(input: KeyboardInput): WindowsControlResponse;
export declare function pressKey(key: string): WindowsControlResponse;
export declare function pressKeyCombination(combination: KeyCombination): Promise<WindowsControlResponse>;
export declare function holdKey(operation: KeyHoldOperation): Promise<WindowsControlResponse>;
