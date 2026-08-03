import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AutomationProvider } from '../interfaces/provider.js';
/**
 * Set up automation tools on the MCP server using Zod validation.
 * This function implements the provider pattern for all tool handlers, allowing
 * for dependency injection of automation implementations.
 *
 * @param server The Model Context Protocol server instance
 * @param provider The automation provider implementation that will handle system interactions
 */
export declare function setupTools(server: Server, provider: AutomationProvider): void;
