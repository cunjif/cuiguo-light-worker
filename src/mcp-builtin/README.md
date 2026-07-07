# Built-in MCP Servers

This directory contains pre-bundled MCP server packages for out-of-the-box experience.

## Structure

```
mcp-builtin/
├── packages/          # Pre-packaged .tgz files
│   ├── playwright-mcp-0.0.10.tgz
│   ├── @modelcontextprotocol+server-filesystem-*.tgz
│   └── ...
├── launcher/          # Cross-platform launcher scripts
│   ├── mcp-launcher.js
│   └── ...
└── registry-data/     # Pre-published registry data (optional)
```

## How it works

1. On first launch, the app publishes all .tgz files to the internal Verdaccio registry
2. MCP servers are then installed to the user data directory
3. Subsequent launches use the installed servers directly
