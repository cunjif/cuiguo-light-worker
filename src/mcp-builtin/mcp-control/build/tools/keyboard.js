import { createAutomationProvider } from '../providers/factory.js';
import { MAX_TEXT_LENGTH, KeySchema, KeyCombinationSchema, KeyHoldOperationSchema, } from './validation.zod.js';
// Get the automation provider
const provider = createAutomationProvider();
export function typeText(input) {
    try {
        // Validate text length
        if (!input.text) {
            throw new Error('Text is required');
        }
        if (input.text.length > MAX_TEXT_LENGTH) {
            throw new Error(`Text too long: ${input.text.length} characters (max ${MAX_TEXT_LENGTH})`);
        }
        return provider.keyboard.typeText(input);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to type text: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export function pressKey(key) {
    try {
        // Validate key using Zod schema
        KeySchema.parse(key);
        return provider.keyboard.pressKey(key);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to press key: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export async function pressKeyCombination(combination) {
    try {
        // Validate the key combination using Zod schema
        KeyCombinationSchema.parse(combination);
        return await provider.keyboard.pressKeyCombination(combination);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to press key combination: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export async function holdKey(operation) {
    try {
        // Validate key hold operation using Zod schema
        KeyHoldOperationSchema.parse(operation);
        return await provider.keyboard.holdKey(operation);
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to ${operation.state} key ${operation.key}: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
