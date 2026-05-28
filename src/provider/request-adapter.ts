import { ModelConfig, RequestSkeleton } from './types.js';
import { getProvider } from './registry.js';

export function buildRequestSkeleton(config: ModelConfig, messages: unknown[]): RequestSkeleton {
  const skeleton: RequestSkeleton = {
    messages,
    model: config.model,
    stream: config.stream,
  };

  if (config.max_tokens_value) {
    skeleton[config.max_tokens_type] = parseInt(config.max_tokens_value);
  }

  if (typeof config.reasoning_effort === 'string') {
    if (config.reasoning_effort === 'false') {
      skeleton['chat_template_kwargs'] = { enable_thinking: false };
    } else {
      skeleton['reasoning_effort'] = config.reasoning_effort;
    }
  }

  if (config.temperature) {
    skeleton['temperature'] = parseFloat(config.temperature);
  }

  if (config.top_p) {
    skeleton['top_p'] = parseFloat(config.top_p);
  }

  return skeleton;
}

export function buildAuthHeaders(config: ModelConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': config.contentType || 'application/json',
  };

  const provider = getProvider(config.provider);
  const authHeaderName = config.authHeaderName || provider.connectionPreset.authHeaderName;
  const authPrefix = config.authPrefix !== undefined ? config.authPrefix : provider.connectionPreset.authPrefix;

  if (config.apiKey) {
    headers[authHeaderName] = `${authPrefix}${config.apiKey}`;
  }

  if (config.provider === 'anthropic-compatible') {
    headers['anthropic-version'] = '2023-06-01';
  }

  return headers;
}

export function adaptRequest(config: ModelConfig, messages: unknown[]): {
  headers: Record<string, string>;
  body: object;
  url: string;
} {
  const provider = getProvider(config.provider);
  const skeleton = buildRequestSkeleton(config, messages);

  let body: object;
  try {
    body = provider.requestTransformer(skeleton, config);
  } catch (e) {
    console.warn(`Request transformer for "${config.provider}" failed, falling back to openai-compatible:`, e);
    const fallback = getProvider('openai-compatible');
    body = fallback.requestTransformer(skeleton, config);
  }

  const headers = buildAuthHeaders(config);
  const url = config.url + (config.path ? config.path : '');

  return { headers, body, url };
}
