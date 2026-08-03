import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AutomationProvider } from '../interfaces/provider.js';
/**
 * Set up automation tools on the MCP server using Zod validation.
 * This function provides robust validation with better error messages.
 *
 * @param server The Model Context Protocol server instance
 * @param provider The automation provider implementation
 */
export declare function setupTools(server: Server, provider: AutomationProvider): void;
