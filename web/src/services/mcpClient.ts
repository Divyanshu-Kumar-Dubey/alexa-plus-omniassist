/**
 * MCP Streamable HTTP Client
 * Connects from the Alexa+ Web Simulator to the self-hosted MCP Server.
 */

const MCP_BASE = 'http://localhost:3001';

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpLogEntry {
  id: string;
  timestamp: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
  latencyMs: number;
}

async function mcpRpc(method: string, params?: Record<string, any>): Promise<any> {
  const res = await fetch(`${MCP_BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function mcpInitialize() {
  return mcpRpc('initialize', {
    protocolVersion: '2025-11-25',
    clientInfo: { name: 'omniassist-web-client', version: '1.0.0' },
    capabilities: {},
  });
}

export async function mcpListTools(): Promise<McpToolDef[]> {
  const result = await mcpRpc('tools/list');
  return result.tools;
}

export async function mcpCallTool(
  name: string,
  args: Record<string, any>
): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }> {
  return mcpRpc('tools/call', { name, arguments: args });
}

export async function mcpReadResource(uri: string) {
  return mcpRpc('resources/read', { uri });
}

export async function mcpGetState(): Promise<any> {
  const res = await fetch(`${MCP_BASE}/state`);
  return res.json();
}

export async function mcpHealth(): Promise<any> {
  const res = await fetch(`${MCP_BASE}/health`);
  return res.json();
}

/**
 * Connect to the SSE stream for live state updates.
 */
export function mcpSubscribeSSE(
  onEvent: (event: string, data: any) => void
): () => void {
  const es = new EventSource(`${MCP_BASE}/sse`);

  es.addEventListener('connected', (e) => {
    onEvent('connected', JSON.parse((e as MessageEvent).data));
  });

  es.addEventListener('state_change', (e) => {
    onEvent('state_change', JSON.parse((e as MessageEvent).data));
  });

  es.onerror = () => {
    // Will auto-reconnect
  };

  return () => es.close();
}
