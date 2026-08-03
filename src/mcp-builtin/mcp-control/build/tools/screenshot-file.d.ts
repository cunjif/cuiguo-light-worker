import { ScreenshotOptions } from '../types/common.js';
import { WindowsControlResponse } from '../types/responses.js';
/**
 * Captures a screenshot and saves it to a temporary file
 *
 * @param options Optional configuration for the screenshot
 * @returns Promise resolving to a WindowsControlResponse with the file path
 */
export declare function getScreenshotToFile(options?: ScreenshotOptions): Promise<WindowsControlResponse>;
