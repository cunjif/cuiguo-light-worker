import { ScreenshotOptions } from '../types/common.js';
import { WindowsControlResponse } from '../types/responses.js';
/**
 * Captures a screenshot with various options for optimization
 *
 * @param options Optional configuration for the screenshot
 * @returns Promise resolving to a WindowsControlResponse with the screenshot data
 */
export declare function getScreenshot(options?: ScreenshotOptions): Promise<WindowsControlResponse>;
