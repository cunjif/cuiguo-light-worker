#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as keyboard from './keyboard.js';
import * as mouse from './mouse.js';
import * as screen from './screen.js';
import * as clipboard from './clipboard.js';

const TOOLS = [
  {
    name: 'get_screenshot',
    description: 'Take a screenshot optimized for AI readability. Uses scrot/import on Linux.',
    inputSchema: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          properties: {
            x: { type: 'number' }, y: { type: 'number' },
            width: { type: 'number' }, height: { type: 'number' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
        format: { type: 'string', enum: ['png', 'jpeg'], default: 'jpeg' },
        quality: { type: 'number', minimum: 1, maximum: 100, default: 85 },
        grayscale: { type: 'boolean', default: true },
        resize: {
          type: 'object',
          properties: {
            width: { type: 'number', default: 1280 },
            height: { type: 'number' },
            fit: { type: 'string', enum: ['contain', 'cover', 'fill', 'inside', 'outside'], default: 'contain' },
          },
        },
      },
    },
  },
  {
    name: 'click_at',
    description: 'Move mouse to coordinates and click',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number' }, y: { type: 'number' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'move_mouse',
    description: 'Move the mouse cursor to specific coordinates',
    inputSchema: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
    },
  },
  {
    name: 'click_mouse',
    description: 'Click the mouse at the current position',
    inputSchema: {
      type: 'object',
      properties: { button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' } },
    },
  },
  {
    name: 'drag_mouse',
    description: 'Drag the mouse from one position to another',
    inputSchema: {
      type: 'object',
      properties: {
        fromX: { type: 'number' }, fromY: { type: 'number' },
        toX: { type: 'number' }, toY: { type: 'number' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
      },
      required: ['fromX', 'fromY', 'toX', 'toY'],
    },
  },
  {
    name: 'scroll_mouse',
    description: 'Scroll the mouse wheel up or down',
    inputSchema: {
      type: 'object',
      properties: { amount: { type: 'number', description: 'Positive for down, negative for up' } },
      required: ['amount'],
    },
  },
  {
    name: 'type_text',
    description: 'Type text using the keyboard',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'press_key',
    description: "Press a specific keyboard key (e.g., 'enter', 'tab', 'escape')",
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'hold_key',
    description: 'Hold or release a keyboard key with optional duration',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        state: { type: 'string', enum: ['down', 'up'] },
        duration: { type: 'number' },
      },
      required: ['key', 'state'],
    },
  },
  {
    name: 'press_key_combination',
    description: 'Press multiple keys simultaneously (e.g., keyboard shortcuts)',
    inputSchema: {
      type: 'object',
      properties: { keys: { type: 'array', items: { type: 'string' } } },
      required: ['keys'],
    },
  },
  {
    name: 'get_screen_size',
    description: 'Get the screen dimensions',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cursor_position',
    description: 'Get the current cursor position',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'double_click',
    description: 'Double click at current or specified position',
    inputSchema: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
    },
  },
  {
    name: 'get_active_window',
    description: 'Get information about the currently active window',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'focus_window',
    description: 'Focus a specific window by its title',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
  {
    name: 'resize_window',
    description: 'Resize a specific window by its title',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } },
      required: ['title', 'width', 'height'],
    },
  },
  {
    name: 'reposition_window',
    description: 'Move a specific window to new coordinates',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
      required: ['title', 'x', 'y'],
    },
  },
  {
    name: 'get_clipboard_content',
    description: 'Get the current text content from the clipboard',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_clipboard_content',
    description: 'Set text content to the clipboard',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'has_clipboard_text',
    description: 'Check if the clipboard contains text',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'clear_clipboard',
    description: 'Clear the clipboard content',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function handleToolCall(name, args) {
  let response;
  switch (name) {
    case 'get_screenshot':
      response = await screen.getScreenshot(args || {});
      break;
    case 'click_at':
      response = await mouse.clickAt(args.x, args.y, args.button || 'left');
      break;
    case 'move_mouse':
      response = await mouse.moveMouse(args);
      break;
    case 'click_mouse':
      response = await mouse.clickMouse(args?.button || 'left');
      break;
    case 'drag_mouse':
      response = await mouse.dragMouse(
        { x: args.fromX, y: args.fromY },
        { x: args.toX, y: args.toY },
        args.button || 'left',
      );
      break;
    case 'scroll_mouse':
      response = await mouse.scrollMouse(args.amount);
      break;
    case 'type_text':
      response = await keyboard.typeText(args);
      break;
    case 'press_key':
      response = await keyboard.pressKey(args.key);
      break;
    case 'hold_key':
      response = await keyboard.holdKey(args);
      break;
    case 'press_key_combination':
      response = await keyboard.pressKeyCombination(args);
      break;
    case 'get_screen_size':
      response = await screen.getScreenSize();
      break;
    case 'get_cursor_position':
      response = await mouse.getCursorPosition();
      break;
    case 'double_click':
      response = await mouse.doubleClick(args);
      break;
    case 'get_active_window':
      response = await screen.getActiveWindow();
      break;
    case 'focus_window':
      response = await screen.focusWindow(args.title);
      break;
    case 'resize_window':
      response = await screen.resizeWindow(args.title, args.width, args.height);
      break;
    case 'reposition_window':
      response = await screen.repositionWindow(args.title, args.x, args.y);
      break;
    case 'get_clipboard_content':
      response = await clipboard.getClipboardContent();
      break;
    case 'set_clipboard_content':
      response = await clipboard.setClipboardContent(args);
      break;
    case 'has_clipboard_text':
      response = await clipboard.hasClipboardText();
      break;
    case 'clear_clipboard':
      response = await clipboard.clearClipboard();
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  if (
    response.content &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    response.content[0]?.type === 'image'
  ) {
    return { content: response.content };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
  };
}

async function main() {
  const server = new Server(
    { name: 'linux-control', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleToolCall(request.params.name, request.params.arguments);
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('linux-control MCP server started');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});