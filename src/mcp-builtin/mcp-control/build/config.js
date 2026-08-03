/**
 * Load configuration from environment variables
 */
export function loadConfig() {
    return {
        provider: process.env.AUTOMATION_PROVIDER || 'keysender',
    };
}
