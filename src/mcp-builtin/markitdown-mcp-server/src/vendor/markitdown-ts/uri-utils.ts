// src/uri-utils.ts

export function fileUriToPath(uri: string): { netloc: string; path: string } {
  // The WHATWG URL spec normalises "localhost" away for file: URIs,
  // so we extract the authority component manually first.
  const authorityMatch = uri.match(/^file:\/\/([^/?#]*)(\/[^?#]*)/);
  if (authorityMatch) {
    const netloc = decodeURIComponent(authorityMatch[1]);
    const path = decodeURIComponent(authorityMatch[2]);
    return { netloc, path };
  }
  // Fallback for file:/path (single-slash, no authority)
  const url = new URL(uri);
  const netloc = url.hostname;
  const path = decodeURIComponent(url.pathname);
  return { netloc, path };
}

export function parseDataUri(uri: string): {
  mimetype: string;
  charset?: string;
  data: Uint8Array;
} {
  const match = uri.match(/^data:([^,]*),(.*)$/s);
  if (!match) throw new Error(`Invalid data URI: ${uri.slice(0, 50)}...`);

  const [, meta, body] = match;
  const parts = meta.split(';');
  const mimetype = parts[0] || 'text/plain';
  const isBase64 = parts.includes('base64');

  let charset: string | undefined;
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === 'charset') {
      charset = part.slice(eq + 1).trim();
    }
  }

  let data: Uint8Array;
  if (isBase64) {
    const binary = atob(body);
    data = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } else {
    data = new TextEncoder().encode(decodeURIComponent(body));
  }

  return { mimetype, charset, data };
}
