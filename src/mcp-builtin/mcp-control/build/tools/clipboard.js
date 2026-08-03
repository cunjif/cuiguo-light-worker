import clipboardy from 'clipboardy';
export async function getClipboardContent() {
    try {
        const content = await clipboardy.read();
        return {
            success: true,
            content,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function setClipboardContent(input) {
    try {
        await clipboardy.write(input.text);
        return {
            success: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function hasClipboardText() {
    try {
        const content = await clipboardy.read();
        return {
            success: true,
            hasText: content.length > 0,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function clearClipboard() {
    try {
        await clipboardy.write('');
        return {
            success: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
