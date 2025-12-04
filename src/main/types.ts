// types.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
export { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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

} from "@modelcontextprotocol/sdk/types.js";


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
  capabilities: Record<string, any>;
}