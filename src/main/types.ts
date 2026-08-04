// types.ts
import { Client } from "../vendor/mcp-sdk/dist/esm/client/index.js";
export { StdioClientTransport } from "../vendor/mcp-sdk/dist/esm/client/stdio.js";
import { HttpClient } from "./client.js";

export {Client, HttpClient}

export {
  CreateMessageRequestSchema,

  CompleteResultSchema,

  ListToolsResultSchema,
  CallToolResultSchema,

  ListPromptsResultSchema,
  GetPromptResultSchema,

  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListResourceTemplatesResultSchema

} from "../vendor/mcp-sdk/dist/esm/types.js";


export interface McpServersConfig {
    mcpServers: {
      [key: string]: ServerConfig;
    };
  }

export interface ServerConfig {
  command?: string;
  url?: string;
  type?: 'local' | 'http' | 'sse';
  // ---- Example ----
  // args: string[];
  [key: string]: any
}

export interface ClientObj {
  name: string;
  client: Client | HttpClient;
  capabilities: Record<string, any> | undefined;
  serverConfig?: Record<string, any>;
}