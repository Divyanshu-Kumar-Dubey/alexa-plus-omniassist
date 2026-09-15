/**
 * Model Context Protocol (MCP) JSON-RPC 2.0 Protocol Engine
 * Implements MCP Specification version 2025-11-25 over Streamable HTTP.
 */

import { registeredTools, executeMcpTool } from './tools';
import { homeState } from './state';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export const MCP_SERVER_INFO = {
  name: 'omniassist-alexa-mcp-server',
  version: '1.0.0',
  protocolVersion: '2025-11-25',
  capabilities: {
    tools: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    prompts: { listChanged: true },
    logging: {},
  },
};

export async function handleMcpJsonRpc(
  request: JsonRpcRequest,
  writeChunk?: (chunk: string) => void
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  // Validate JSON-RPC 2.0
  if (request.jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
    };
  }

  switch (method) {
    case 'initialize': {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: MCP_SERVER_INFO.protocolVersion,
          serverInfo: {
            name: MCP_SERVER_INFO.name,
            version: MCP_SERVER_INFO.version,
          },
          capabilities: MCP_SERVER_INFO.capabilities,
          instructions:
            'OmniAssist Alexa+ MCP Server provides tools to inspect, control, and orchestrate smart home devices, IoT cameras, climate, lighting, and ambient routines.',
        },
      };
    }

    case 'notifications/initialized': {
      // Client confirmed initialization
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: { initialized: true },
      };
    }

    case 'ping': {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: { pong: true, timestamp: Date.now() },
      };
    }

    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          tools: registeredTools,
        },
      };
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32602, message: 'Invalid params: "name" is required' },
        };
      }

      // If streaming callback provided, emit a progress notification chunk
      if (writeChunk) {
        writeChunk(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/progress',
            params: { progressToken: id, status: `Executing tool ${toolName}...` },
          }) + '\n'
        );
      }

      try {
        const result = await executeMcpTool(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result,
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32000,
            message: `Tool execution failed: ${err.message || String(err)}`,
          },
        };
      }
    }

    case 'resources/list': {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          resources: [
            {
              uri: 'alexa://devices/status',
              name: 'Connected Device Registry',
              description: 'Current real-time state of all smart home devices and sensors.',
              mimeType: 'application/json',
            },
            {
              uri: 'alexa://user/preferences',
              name: 'Ambient User Profile & Preferences',
              description: 'Preferred home temperatures, lighting scenes, and quiet hours.',
              mimeType: 'application/json',
            },
          ],
        },
      };
    }

    case 'resources/read': {
      const uri = params?.uri;
      if (uri === 'alexa://devices/status') {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(homeState.getFullSnapshot(), null, 2),
              },
            ],
          },
        };
      } else if (uri === 'alexa://user/preferences') {
        const prefs = {
          preferredTemp: 71,
          preferredLighting: 'warm',
          quietHours: '22:00-07:00',
          wakeWord: 'Alexa',
          voiceSpeed: 1.0,
        };
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(prefs, null, 2),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32002, message: `Resource not found: ${uri}` },
      };
    }

    case 'prompts/list': {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          prompts: [
            {
              name: 'daily_briefing',
              description: 'Generates a morning briefing combining weather, traffic, and calendar.',
              arguments: [{ name: 'userName', description: 'Name of the user', required: false }],
            },
            {
              name: 'security_alert',
              description: 'Emergency response prompt when an unknown motion or door event is logged.',
              arguments: [{ name: 'location', description: 'Triggered location', required: true }],
            },
          ],
        },
      };
    }

    case 'prompts/get': {
      const pName = params?.name;
      if (pName === 'daily_briefing') {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            description: 'Daily briefing prompt',
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: 'You are Alexa+, an intelligent, concise, and helpful assistant. Synthesize the user\'s daily status, IoT camera events, and weather report into a warm, natural summary.',
                },
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: `Unknown prompt: ${pName}` },
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}
