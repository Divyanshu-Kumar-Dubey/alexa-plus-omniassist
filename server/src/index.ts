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
 * Health Check & Diagnostics Dashboard
 */
app.get('/health', (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    server: MCP_SERVER_INFO,
    activeToolsCount: registeredTools.length,
    activeDevicesCount: homeState.getDevices().length,
    tools: registeredTools.map((t) => ({ name: t.name, description: t.description })),
    timestamp: new Date().toISOString(),
  };

  // If accessed from a web browser, render a luxury dark glassmorphic dashboard
  if (req.accepts('html') && !req.xhr && !req.headers['sec-fetch-dest']?.includes('empty')) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniAssist MCP Server | Diagnostics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #060913 radial-gradient(circle at 50% 0%, rgba(0,202,255,0.12) 0%, transparent 60%);
      color: #f1f5f9;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 32px 20px;
      display: flex;
      justify-content: center;
    }
    .container { width: 100%; max-width: 960px; display: flex; flex-direction: column; gap: 24px; }
    .glass {
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 24px 28px;
      box-shadow: 0 16px 40px -10px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .title-group { display: flex; align-items: center; gap: 14px; }
    .orb {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00caff, #0073bb);
      box-shadow: 0 0 20px rgba(0,202,255,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    h1 { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; }
    .status-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(16,185,129,0.15);
      border: 1px solid #10b981;
      color: #34d399;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
    .stat-val { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: #00caff; }
    .tools-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .tool-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 12px;
      padding: 14px 18px;
    }
    .tool-name { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: #38bdf8; }
    .tool-desc { font-size: 13px; color: #cbd5e1; margin-top: 4px; }
    .btn-row { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 10px;
      background: linear-gradient(135deg, #00caff, #0073bb);
      color: #060913;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 0 20px rgba(0,202,255,0.4); }
    .btn-secondary { background: rgba(255,255,255,0.06); color: #ffffff; border: 1px solid rgba(255,255,255,0.1); }
    .btn-secondary:hover { background: rgba(255,255,255,0.12); box-shadow: none; }
    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #94a3b8;
      background: rgba(0,0,0,0.4);
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
      border: 1px solid rgba(255,255,255,0.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="glass header">
      <div class="title-group">
        <div class="orb">⚡</div>
        <div>
          <h1>OmniAssist MCP Server</h1>
          <p style="font-size: 13px; color: #94a3b8;">Streamable HTTP Transport &bull; Spec 2025-11-25</p>
        </div>
      </div>
      <div class="status-tag">
        <span class="dot"></span>
        <span>HEALTHY &bull; ONLINE</span>
      </div>
    </div>

    <div class="glass">
      <div class="grid">
        <div class="stat-card">
          <span class="stat-label">Protocol Version</span>
          <span class="stat-val" style="font-size: 18px;">2025-11-25</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Registered MCP Tools</span>
          <span class="stat-val">${healthData.activeToolsCount} Tools</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Virtual IoT Devices</span>
          <span class="stat-val">${healthData.activeDevicesCount} Devices</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Server Port</span>
          <span class="stat-val">3001</span>
        </div>
      </div>

      <div class="btn-row">
        <a href="http://localhost:5173" class="btn">🚀 Open Alexa+ Web Canvas (Port 5173)</a>
        <a href="https://github.com/Divyanshu-Kumar-Dubey/alexa-plus-omniassist" target="_blank" class="btn btn-secondary">⭐ GitHub Repository</a>
      </div>
    </div>

    <div class="glass">
      <h2 style="font-family: 'Outfit'; font-size: 18px; margin-bottom: 8px;">Active Model Context Protocol (MCP) Tools</h2>
      <div class="tools-list">
        ${healthData.tools
          .map(
            (t) => `
          <div class="tool-item">
            <span style="font-size: 20px;">🛠️</span>
            <div>
              <div class="tool-name">${t.name}</div>
              <div class="tool-desc">${t.description}</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="glass">
      <h2 style="font-family: 'Outfit'; font-size: 16px; margin-bottom: 10px;">Raw JSON Telemetry</h2>
      <pre>${JSON.stringify(healthData, null, 2)}</pre>
    </div>
  </div>
</body>
</html>`;
    return res.type('html').send(html);
  }

  return res.json(healthData);
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
