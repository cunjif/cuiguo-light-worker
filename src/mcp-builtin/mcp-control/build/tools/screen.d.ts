import { WindowsControlResponse } from '../types/responses.js';
export declare function getScreenSize(): WindowsControlResponse;
export declare function getActiveWindow(): WindowsControlResponse;
export declare function focusWindow(title: string): WindowsControlResponse;
export declare function resizeWindow(title: string, width: number, height: number): Promise<WindowsControlResponse>;
export declare function repositionWindow(title: string, x: number, y: number): Promise<WindowsControlResponse>;
