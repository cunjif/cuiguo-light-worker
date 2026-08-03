import express from 'express';
import * as http from 'http';
import * as https from 'https';
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * Default port for the SSE server
 */
export declare const DEFAULT_PORT = 3232;
/**
 * Creates and configures an HTTP server with SSE support
 * @param mcpServer The MCP server instance to connect with
 * @param port The port to listen on (default: DEFAULT_PORT)
 * @param useHttps Whether to use HTTPS (default: false)
 * @param certPath Path to TLS certificate (only used when useHttps is true)
 * @param keyPath Path to TLS key (only used when useHttps is true)
 * @returns Object containing the express app, http server
 */
export declare function createHttpServer(mcpServer: MCPServer, port?: number, useHttps?: boolean, certPath?: string, keyPath?: string): {
    app: ReturnType<typeof express>;
    httpServer: http.Server | https.Server;
};
