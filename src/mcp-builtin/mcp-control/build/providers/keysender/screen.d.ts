import { ScreenshotOptions } from '../../types/common.js';
import { WindowsControlResponse } from '../../types/responses.js';
import { ScreenAutomation } from '../../interfaces/automation.js';
/**
 * Keysender implementation of the ScreenAutomation interface
 *
 * Note: The keysender library has limited support for screen operations.
 * Some functionality is implemented with fallbacks or limited capabilities.
 */
export declare class KeysenderScreenAutomation implements ScreenAutomation {
    private hardware;
    getScreenSize(): WindowsControlResponse;
    /**
     * Helper method to find a suitable window for operations
     * @param targetTitle Optional title to search for
     * @returns Window information or null if no suitable window found
     */
    private findSuitableWindow;
    getActiveWindow(): WindowsControlResponse;
    focusWindow(title: string): WindowsControlResponse;
    /**
     * Helper method to handle common functionality for window positioning and resizing
     * @param windowTitle Title of the window to update
     * @param x X coordinate for repositioning, null for resize-only
     * @param y Y coordinate for repositioning, null for resize-only
     * @param width Width for resizing, null for reposition-only
     * @param height Height for resizing, null for reposition-only
     * @param operationType Type of operation being performed
     * @returns Window control response
     */
    private updateWindowPosition;
    resizeWindow(title: string, width: number, height: number): Promise<WindowsControlResponse>;
    repositionWindow(title: string, x: number, y: number): Promise<WindowsControlResponse>;
    /**
     * Captures a screenshot of the entire screen or a specific region with optimized memory usage
     * @param options - Optional configuration for the screenshot:
     *                  - region: Area to capture (x, y, width, height)
     *                  - format: Output format ('png' or 'jpeg')
     *                  - quality: JPEG quality (1-100)
     *                  - compressionLevel: PNG compression level (0-9)
     *                  - grayscale: Convert to grayscale
     *                  - resize: Resize options (width, height, fit)
     * @returns Promise<WindowsControlResponse> with base64-encoded image data
     */
    getScreenshot(options?: ScreenshotOptions): Promise<WindowsControlResponse>;
}
