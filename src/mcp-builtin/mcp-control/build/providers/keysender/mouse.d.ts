import { MousePosition } from '../../types/common.js';
import { WindowsControlResponse } from '../../types/responses.js';
import { MouseAutomation } from '../../interfaces/automation.js';
/**
 * Keysender implementation of the MouseAutomation interface
 */
export declare class KeysenderMouseAutomation implements MouseAutomation {
    private mouse;
    /**
     * Validates mouse position against screen bounds including actual screen size
     * @param position Position to validate
     * @returns Validated position
     * @throws Error if position is invalid or out of bounds
     */
    private validatePositionAgainstScreen;
    moveMouse(position: MousePosition): WindowsControlResponse;
    clickMouse(button?: 'left' | 'right' | 'middle'): WindowsControlResponse;
    doubleClick(position?: MousePosition): WindowsControlResponse;
    getCursorPosition(): WindowsControlResponse;
    scrollMouse(amount: number): WindowsControlResponse;
    dragMouse(from: MousePosition, to: MousePosition, button?: 'left' | 'right' | 'middle'): WindowsControlResponse;
    clickAt(x: number, y: number, button?: 'left' | 'right' | 'middle'): WindowsControlResponse;
}
