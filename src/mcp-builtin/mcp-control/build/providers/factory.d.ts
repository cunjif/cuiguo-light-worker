import { AutomationProvider } from '../interfaces/provider.js';
/**
 * Create an automation provider instance based on the specified type
 * Uses a caching mechanism to avoid creating multiple instances of the same provider
 */
export declare function createAutomationProvider(type?: string): AutomationProvider;
