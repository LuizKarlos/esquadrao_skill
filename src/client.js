import { getEndpoint, getToken } from './config.js';

// ponytail: single-turn HTTP fetch; upgrade to persistent SSE reader / WebSocket when bidirectional server notifications needed
export async function sendRpc(method, params = {}, options = {}) {
  const endpoint = options.endpoint || getEndpoint();
  const token = options.token !== undefined ? options.token : getToken();
  const origin = new URL(endpoint).origin;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: token ? `Bearer ${token}` : undefined,
    Origin: origin,
    ...options.headers,
  };
  if (!headers['Authorization']) delete headers['Authorization'];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error?.message) msg = `${msg} - ${errData.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          data = JSON.parse(line.slice(5).trim());
          break;
        } catch {}
      }
    }
  } else {
    data = await res.json();
  }

  if (!data) throw new Error('Empty or invalid response from server');
  if (data.error) {
    throw new Error(data.error.message || `RPC Error ${data.error.code}`);
  }
  return data.result;
}

export async function callTool(name, args = {}, options = {}) {
  return sendRpc('tools/call', { name, arguments: args }, options);
}

export async function listTools(options = {}) {
  return sendRpc('tools/list', {}, options);
}

export async function checkHealth(options = {}) {
  const endpoint = options.endpoint || getEndpoint();
  const origin = new URL(endpoint).origin;
  try {
    const res = await fetch(`${origin}/health`, { signal: options.signal });
    if (res.ok) return await res.json();
  } catch {}
  try {
    return await callTool('health', {}, options);
  } catch {
    return await callTool('megabrain_health', {}, options);
  }
}
