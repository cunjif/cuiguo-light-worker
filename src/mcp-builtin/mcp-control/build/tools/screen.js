import { createAutomationProvider } from '../providers/factory.js';
export function getScreenSize() {
    try {
        const provider = createAutomationProvider();
        return provider.screen.getScreenSize();
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to get screen size: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export function getActiveWindow() {
    try {
        const provider = createAutomationProvider();
        return provider.screen.getActiveWindow();
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to get active window information: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export function focusWindow(title) {
    try {
        const provider = createAutomationProvider();
        return provider.screen.focusWindow(title);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to focus window: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export async function resizeWindow(title, width, height) {
    try {
        const provider = createAutomationProvider();
        return await provider.screen.resizeWindow(title, width, height);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to resize window: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export async function repositionWindow(title, x, y) {
    try {
        const provider = createAutomationProvider();
        return await provider.screen.repositionWindow(title, x, y);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to reposition window: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
