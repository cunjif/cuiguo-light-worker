import clipboardy from 'clipboardy';
/**
 * Keysender implementation of the ClipboardAutomation interface
 *
 * Note: Since keysender doesn't provide direct clipboard functionality,
 * we use the clipboardy library (same as the NutJS implementation)
 */
export class KeysenderClipboardAutomation {
    async getClipboardContent() {
        try {
            const content = await clipboardy.read();
            return {
                success: true,
                message: 'Clipboard content retrieved',
                data: content,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to get clipboard content: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    async setClipboardContent(input) {
        try {
            await clipboardy.write(input.text);
            return {
                success: true,
                message: 'Clipboard content set',
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to set clipboard content: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    async hasClipboardText() {
        try {
            const content = await clipboardy.read();
            const hasText = content.length > 0;
            return {
                success: true,
                message: `Clipboard ${hasText ? 'has' : 'does not have'} text`,
                data: hasText,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to check clipboard: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    async clearClipboard() {
        try {
            await clipboardy.write('');
            return {
                success: true,
                message: 'Clipboard cleared',
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to clear clipboard: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
