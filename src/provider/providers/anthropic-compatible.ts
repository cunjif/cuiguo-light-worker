import { ProviderConfig, NormalizedDelta, RequestSkeleton, ModelConfig, ToolCallDelta, FinishReason } from '../types.js';
import { registerProvider } from '../registry.js';

function anthropicRequestTransformer(skeleton: RequestSkeleton, _config: ModelConfig): object {
  const body = { ...skeleton } as Record<string, unknown>;
  const messages = [...(body.messages as unknown[])] as Array<Record<string, unknown>>;

  const systemMessages = messages.filter((m) => m.role === 'system');
  const otherMessages = messages.filter((m) => m.role !== 'system');

  const result: Record<string, unknown> = { ...body };
  result.messages = otherMessages;

  if (systemMessages.length > 0) {
    result.system = systemMessages.map((m) => m.content).join('\n\n');
  }

  if (!result.max_tokens) {
    result.max_tokens = 8192;
  }

  return result;
}

function anthropicResponseTransformer(sseChunk: unknown): NormalizedDelta | null {
  const chunk = sseChunk as Record<string, unknown>;

  if (chunk.type === 'content_block_delta') {
    const delta = chunk.delta as Record<string, unknown>;
    if (!delta) return null;

    if (delta.type === 'text_delta') {
      return {
        content: typeof delta.text === 'string' ? delta.text : '',
        reasoning_content: '',
        tool_calls: [],
        finish_reason: null,
      };
    }

    if (delta.type === 'thinking_delta') {
      return {
        content: '',
        reasoning_content: typeof delta.thinking === 'string' ? delta.thinking : '',
        tool_calls: [],
        finish_reason: null,
      };
    }

    if (delta.type === 'input_json_delta') {
      return {
        content: '',
        reasoning_content: '',
        tool_calls: [{
          function: { arguments: typeof delta.partial_json === 'string' ? delta.partial_json : '' },
        }],
        finish_reason: null,
      };
    }

    return null;
  }

  if (chunk.type === 'content_block_start') {
    const contentBlock = chunk.content_block as Record<string, unknown>;
    if (contentBlock && contentBlock.type === 'tool_use') {
      const toolCall: ToolCallDelta = {
        id: typeof contentBlock.id === 'string' ? contentBlock.id : undefined,
        function: { name: typeof contentBlock.name === 'string' ? contentBlock.name : undefined },
      };
      return {
        content: '',
        reasoning_content: '',
        tool_calls: [toolCall],
        finish_reason: null,
      };
    }
    return null;
  }

  if (chunk.type === 'message_delta') {
    const delta = chunk.delta as Record<string, unknown>;
    return {
      content: '',
      reasoning_content: '',
      tool_calls: [],
      finish_reason: (['stop', 'length', 'tool_calls', 'end_turn'].includes(delta?.stop_reason as string) ? delta?.stop_reason as FinishReason : null),
    };
  }

  if (chunk.type === 'message_start' || chunk.type === 'ping' || chunk.type === 'message_stop') {
    return null;
  }

  return null;
}

function anthropicErrorTransformer(errorResponse: unknown): string {
  const err = errorResponse as Record<string, unknown>;
  if (err.error && typeof err.error === 'object') {
    const errorObj = err.error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') return errorObj.message;
  }
  return String(err.message || 'Unknown error');
}

export const anthropicCompatibleProvider: ProviderConfig = {
  type: 'anthropic-compatible',
  connectionPreset: {
    defaultUrl: 'https://api.anthropic.com',
    defaultPath: '/v1/messages',
    defaultModel: 'claude-3-5-sonnet-20241022',
    authHeaderName: 'x-api-key',
    authPrefix: '',
  },
  capabilities: {
    streamSupported: true,
    toolCallSupported: true,
    reasoningSupported: true,
    seedSupported: false,
  },
  requestTransformer: anthropicRequestTransformer,
  responseTransformer: anthropicResponseTransformer,
  errorTransformer: anthropicErrorTransformer,
};

export function registerAnthropicCompatible(): void {
  registerProvider(anthropicCompatibleProvider);
}
