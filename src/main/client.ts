// client.ts
import { Client, StdioClientTransport, CreateMessageRequestSchema, ServerConfig } from './types.js';

/**
 * HTTP/SSE Client for URL-based MCP servers
 */
export class HttpClient {
  private url: string;
  private name: string;
  private capabilities: Record<string, any>;

  constructor(name: string, url: string) {
    this.name = name;
    this.url = url;
    this.capabilities = {
      tools: {},
      prompts: {},
      resources: {}
    };
  }

  getServerCapabilities() {
    return this.capabilities;
  }

  async request(requestObject: any, schema: any) {
    // For MCP over HTTP, we need to send the full JSON-RPC request to the base URL
    const endpoint = this.url;
    console.log(`HTTP Client requesting: ${endpoint}`, requestObject);
    
    // Create proper JSON-RPC request
    const jsonRpcRequest = {
      jsonrpc: "2.0",
      id: Date.now(), // Simple ID generation
      method: requestObject.method,
      params: requestObject.params || {}
    };
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(jsonRpcRequest)
      });

      // Log response details for debugging
      console.log(`HTTP Client response status: ${response.status} ${response.statusText}`);
      // Convert Headers object to a plain object for logging
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      console.log(`HTTP Client response headers:`, headersObj);
      
      if (!response.ok) {
        // Try to read the response body for more details on the error
        const errorText = await response.text();
        console.error(`HTTP Client error response body:`, errorText);
        throw new Error(`HTTP request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`HTTP Client response from ${endpoint}:`, result);
      
      // Return the result part of the JSON-RPC response
      if (result.error) {
        throw new Error(`JSON-RPC Error: ${result.error.message}`);
      }
      
      return result.result;
    } catch (error) {
      console.error(`HTTP Client error for ${endpoint}:`, error);
      throw error;
    }
  }

  setRequestHandler(schema: any, handler: any) {
    // HTTP clients don't handle sampling requests in the same way
    console.log(`HTTP client ${this.name} setRequestHandler called (not implemented for HTTP clients)`);
  }

  async connect() {
    console.log(`HTTP Client ${this.name} connected to ${this.url}`);
    // Test connection by making a simple health check request
    try {
      // Try a simple GET request first to test basic connectivity
      const response = await fetch(this.url);
      // Accept any response (even 400) as long as the server is reachable
      console.log(`HTTP Client ${this.name} connection test: server responded with status ${response.status}`);
      
      // For MCP servers, a 400 response might be normal for a simple GET
      // since they expect POST requests with JSON-RPC payloads
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      console.log(`HTTP Client ${this.name} connection test successful`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
        console.error(`HTTP Client ${this.name} connection test failed: Server not reachable at ${this.url}`);
        throw new Error(`Cannot connect to HTTP server at ${this.url}: Server not reachable`);
      }
      console.error(`HTTP Client ${this.name} connection test failed:`, error);
      throw error;
    }
  }

  disconnect() {
    console.log(`HTTP Client ${this.name} disconnected`);
  }

  getUrl(): string {
    return this.url;
  }
}

export async function initializeClient(name: string, config: ServerConfig): Promise<Client | HttpClient> {
    console.log(`Initializing client for ${name} with config:`, config);
    
    // Determine server type based on configuration
    const serverType = config.type || (config.url ? 'http' : 'local');
    
    if (serverType === 'http' || serverType === 'sse' || config.url) {
        console.log(`Creating HTTP/SSE client for ${name} at ${config.url}`);
        
        if (!config.url) {
            throw new Error(`HTTP/SSE server ${name} must have a 'url' property`);
        }
        
        const httpClient = new HttpClient(name, config.url);
        await httpClient.connect();
        
        console.log(`HTTP/SSE client ${name} initialized successfully`);
        return httpClient;
    }
    
    // For local command-based servers
    if (serverType === 'local' || config.command) {
        console.log(`Creating local MCP client for ${name} with command: ${config.command}`);
        
        if (!config.command) {
            throw new Error(`Local MCP server ${name} must have a 'command' property`);
        }

        const transport = new StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: config.env || process.env,
        });
        
        const client_name = `${name}-client`;
        const client = new Client({
            name: client_name,
            version: "1.0.0",
        }, {
            capabilities: {
                "sampling": {}
            }
        });
        
        await client.connect(transport);
        console.log(`${client_name} connected.`);

        client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
            console.log('Sampling request received:\n', request)
            return {
                model: "test-sampling-model",
                stopReason: "endTurn",
                role: "assistant",
                content: {
                    type: "text",
                    text: "This is a test message from the client used for sampling the LLM. If you receive this message, please stop further attempts, as the sampling test has been successful.",
                }
            };
        });

        console.log(`Local MCP client ${name} initialized successfully`);
        return client;
    }
    
    throw new Error(`Server ${name} must have either 'url' or 'command' property, or specify 'type' as 'local' or 'http'`);
}

export async function manageRequests(
    client: Client | HttpClient,
    method: string,
    schema: any,
    params?: any
) {
    const requestObject = {
        method: method,
        ...(params && { params: params })
    };

    const result = await client.request(requestObject, schema);
    console.log(result);
    return result;
}