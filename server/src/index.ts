/**
 * OmniAssist Alexa+ Self-Hosted Model Context Protocol (MCP) Server
 * Adheres to MCP Spec 2025-11-25 over Streamable HTTP Transport.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { handleMcpJsonRpc, JsonRpcRequest, MCP_SERVER_INFO } from './mcpProtocol';
import { homeState } from './state';
import { registeredTools } from './tools';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// List of connected SSE clients for live notifications
interface SseClient {
  id: string;
  res: Response;
}
let sseClients: SseClient[] = [];

function broadcastSse(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client may have closed
    }
  });
}

// Hook state logging to broadcast SSE
const originalLogAction = homeState.logAction.bind(homeState);
homeState.logAction = (action: string, source: string, details: any) => {
  originalLogAction(action, source, details);
  broadcastSse('state_change', {
    action,
    source,
    details,
    snapshot: homeState.getFullSnapshot(),
  });
};

/**
 * Health Check & Capabilities
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: MCP_SERVER_INFO,
    activeToolsCount: registeredTools.length,
    activeDevicesCount: homeState.getDevices().length,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Tools discovery endpoint
 */
app.get('/tools', (_req: Request, res: Response) => {
  res.json({
    tools: registeredTools,
  });
});

/**
 * Virtual Home & Ambient State Snapshot
 */
app.get('/state', (_req: Request, res: Response) => {
  res.json(homeState.getFullSnapshot());
});

/**
 * Server-Sent Events (SSE) Stream
 * Allows connected Alexa+ Web apps to receive proactive alerts, sensor changes, and tool logs
 */
app.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  sseClients.push({ id: clientId, res });

  // Initial welcome message
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      clientId,
      server: MCP_SERVER_INFO.name,
      snapshot: homeState.getFullSnapshot(),
    })}\n\n`
  );

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

/**
 * Model Context Protocol (MCP) Streamable HTTP Endpoint
 * Handles POST requests containing JSON-RPC 2.0 payloads.
 * Supports chunked transfer encoding responses for real-time progress updates.
 */
app.post('/mcp', async (req: Request, res: Response) => {
  const requestBody = req.body as JsonRpcRequest;

  if (!requestBody || typeof requestBody !== 'object') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Request body must be a JSON object' },
    });
    return;
  }

  // Check if client supports or requests streaming chunked responses
  const acceptStreaming =
    req.headers['accept']?.includes('text/event-stream') ||
    req.headers['x-mcp-streaming'] === 'true';

  if (acceptStreaming) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeChunk = (chunk: string) => {
      res.write(`data: ${chunk}\n\n`);
    };

    const response = await handleMcpJsonRpc(requestBody, writeChunk);
    res.write(`data: ${JSON.stringify(response)}\n\n`);
    res.end();
  } else {
    // Standard JSON-RPC 2.0 HTTP response
    const response = await handleMcpJsonRpc(requestBody);
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  }
});

app.listen(PORT, () => {
  console.log(`\n===========================================================`);
  console.log(`🚀 OmniAssist Alexa+ MCP Server running on port ${PORT}`);
  console.log(`📡 Streamable HTTP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`⚡ Server-Sent Events (SSE):  http://localhost:${PORT}/sse`);
  console.log(`🔍 Health Diagnostics:       http://localhost:${PORT}/health`);
  console.log(`===========================================================\n`);
});
