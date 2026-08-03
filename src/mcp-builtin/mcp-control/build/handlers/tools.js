import { setupTools as setupToolsWithZod } from './tools.zod.js';
/**
 * Set up automation tools on the MCP server using Zod validation.
 * This function provides robust validation with better error messages.
 *
 * @param server The Model Context Protocol server instance
 * @param provider The automation provider implementation
 */
export function setupTools(server, provider) {
    setupToolsWithZod(server, provider);
}
