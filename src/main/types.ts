// types.ts
export { Client } from "@modelcontextprotocol/sdk/client/index.js";
export { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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
  command: string;
  // ---- Example ----
  // args: string[];
  [key: string]: any
}
