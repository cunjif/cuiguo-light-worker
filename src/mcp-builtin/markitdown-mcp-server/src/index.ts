#!/usr/bin/env node

import { McpServer } from './vendor/mcp-sdk/dist/esm/server/mcp.js';
import { StdioServerTransport } from './vendor/mcp-sdk/dist/esm/server/stdio.js';
import { registerConvertTool } from './tool-register.js';
import * as logger from './logger.js';

const PACKAGE_VERSION = '1.0.0';

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'markitdown',
    version: PACKAGE_VERSION,
  });

  registerConvertTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('markitdown-mcp-server started', { version: PACKAGE_VERSION });
}

main().catch((err) => {
  logger.error('Fatal error starting server', { error: String(err) });
  process.exit(1);
});