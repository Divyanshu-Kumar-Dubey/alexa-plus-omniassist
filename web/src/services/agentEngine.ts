/**
 * Autonomous Agent Engine – Embedded Reasoning for Alexa+ Simulation
 *
 * This module provides a LOCAL agentic reasoning loop that:
 *   1. Takes the user's natural language prompt
 *   2. Selects the best MCP tool(s) to call via keyword/intent matching
 *   3. Executes the tool through the MCP server
 *   4. Synthesizes a natural, Alexa-style spoken response
 *
 * No external LLM API key is required. When you add AWS credentials later,
 * swap this for Amazon Bedrock Converse Stream calls.
 */

import { mcpCallTool, McpLogEntry } from './mcpClient';

export interface AgentResponse {
  speech: string;
  toolsCalled: Array<{ name: string; args: any; result: string }>;
  logs: McpLogEntry[];
}

interface IntentMatch {
  tool: string;
  args: Record<string, any>;
}

function detectIntents(prompt: string): IntentMatch[] {
  const p = prompt.toLowerCase();
  const intents: IntentMatch[] = [];

  // ---- Lighting ----
  const lightRooms = ['living room', 'kitchen', 'bedroom'];
  for (const room of lightRooms) {
    if (p.includes(room) && (p.includes('light') || p.includes('lamp') || p.includes('dim') || p.includes('bright'))) {
      let action = 'turn_on';
      let value: string | undefined;

      if (p.includes('off') || p.includes('turn off')) action = 'turn_off';
      else if (p.includes('dim')) { action = 'set_brightness'; value = '20'; }
      else {
        const bMatch = p.match(/(\d{1,3})\s*%/);
        if (bMatch) { action = 'set_brightness'; value = bMatch[1]; }
      }

      if (p.includes('warm')) { action = 'set_color'; value = '#FFE4B5'; }
      if (p.includes('cool') || p.includes('white')) { action = 'set_color'; value = '#FFFFFF'; }
      if (p.includes('red')) { action = 'set_color'; value = '#FF4444'; }
      if (p.includes('blue')) { action = 'set_color'; value = '#4488FF'; }

      intents.push({ tool: 'smart_home_control', args: { target: `${room} light`, action, ...(value ? { value } : {}) } });
    }
  }

  // All lights
  if ((p.includes('all lights') || p.includes('every light')) && !intents.length) {
    const action = p.includes('off') ? 'turn_off' : 'turn_on';
    for (const room of lightRooms) {
      intents.push({ tool: 'smart_home_control', args: { target: `${room} light`, action } });
    }
  }

  // ---- Thermostat ----
  if (p.includes('thermostat') || p.includes('temperature') || p.includes('degrees') || p.includes('temp')) {
    const tMatch = p.match(/(\d{2,3})\s*(degrees|°|f)?/i);
    const temp = tMatch ? tMatch[1] : '72';
    intents.push({ tool: 'smart_home_control', args: { target: 'thermostat', action: 'set_temperature', value: temp } });
  }

  // ---- Door / Lock ----
  if (p.includes('lock') || p.includes('door')) {
    const action = p.includes('unlock') ? 'unlock' : 'lock';
    intents.push({ tool: 'smart_home_control', args: { target: 'front door lock', action } });
  }

  // ---- Camera / Ring ----
  if (p.includes('camera') || p.includes('ring') || p.includes('front door') && (p.includes('check') || p.includes('see') || p.includes('look'))) {
    if (!intents.some(i => i.tool === 'iot_camera_query')) {
      intents.push({ tool: 'iot_camera_query', args: { cameraId: 'camera_front_door', queryType: 'live_snapshot' } });
    }
  }
  if (p.includes('package') || p.includes('delivery')) {
    intents.push({ tool: 'iot_camera_query', args: { cameraId: 'camera_front_door', queryType: 'package_detection' } });
  }

  // ---- Routines ----
  if (p.includes('movie night') || p.includes('movie mode')) {
    intents.push({ tool: 'schedule_smart_routine', args: { routineName: 'Movie Night', triggerNow: true } });
  }
  if (p.includes('good morning') || p.includes('wake up')) {
    intents.push({ tool: 'schedule_smart_routine', args: { routineName: 'Good Morning', triggerNow: true } });
  }
  if (p.includes('goodbye') || p.includes('leaving') || p.includes('away')) {
    intents.push({ tool: 'schedule_smart_routine', args: { routineName: 'Away', triggerNow: true } });
  }

  // ---- Calendar / Concierge ----
  if (p.includes('calendar') || p.includes('schedule') || p.includes('meeting') || p.includes('appointment')) {
    intents.push({ tool: 'personal_concierge_query', args: { category: 'calendar', detailQuery: prompt } });
  }
  if (p.includes('traffic') || p.includes('commute')) {
    intents.push({ tool: 'personal_concierge_query', args: { category: 'traffic', detailQuery: prompt } });
  }
  if (p.includes('grocery') || p.includes('shopping list') || p.includes('order')) {
    intents.push({ tool: 'personal_concierge_query', args: { category: 'grocery' } });
  }
  if (p.includes('flight') || p.includes('airplane') || p.includes('travel')) {
    intents.push({ tool: 'personal_concierge_query', args: { category: 'flights' } });
  }
  if (p.includes('remind')) {
    intents.push({ tool: 'personal_concierge_query', args: { category: 'reminders', detailQuery: prompt } });
  }

  // ---- Weather / Air ----
  if (p.includes('weather') || p.includes('air quality') || p.includes('humid') || p.includes('forecast')) {
    intents.push({ tool: 'weather_air_quality', args: { scope: 'full_diagnostic' } });
  }

  // ---- Media ----
  if (p.includes('fire tv') || p.includes('play') || p.includes('pause') || p.includes('volume') || p.includes('prime video') || p.includes('netflix')) {
    let action = 'play';
    let mediaTitle: string | undefined;
    let volumeLevel: number | undefined;

    if (p.includes('pause') || p.includes('stop')) action = 'pause';
    if (p.includes('volume')) {
      action = 'set_volume';
      const vMatch = p.match(/volume\s*(?:to\s*)?(\d+)/i);
      volumeLevel = vMatch ? parseInt(vMatch[1], 10) : 30;
    }
    if (p.includes('prime video')) mediaTitle = 'Prime Video';
    if (p.includes('netflix')) mediaTitle = 'Netflix';
    if (p.includes('launch') || p.includes('open')) action = 'launch_app';

    intents.push({
      tool: 'execute_media_action',
      args: { action, ...(mediaTitle ? { mediaTitle } : {}), ...(volumeLevel !== undefined ? { volumeLevel } : {}) },
    });
  }

  return intents;
}

function synthesizeSpeech(prompt: string, toolResults: Array<{ name: string; result: string }>): string {
  if (!toolResults.length) {
    return "I'm not sure how to help with that yet. Try asking me to control your lights, check the camera, adjust the thermostat, or activate a routine like Movie Night.";
  }

  // Extract key result summaries
  const summaries = toolResults.map(t => {
    // Strip the [MCP:xxx] prefix for cleaner speech
    const clean = t.result.replace(/\[MCP:\w+\]\s*(Success:\s*)?/g, '').trim();
    return clean;
  });

  const greeting = prompt.toLowerCase().includes('good morning') ? "Good morning! " : "";
  const conjunction = summaries.length > 1 ? `I've done ${summaries.length} things for you. ` : "";

  return `${greeting}${conjunction}${summaries.join(' Also, ')}`;
}

export async function runAgentLoop(prompt: string): Promise<AgentResponse> {
  const intents = detectIntents(prompt);
  const toolsCalled: AgentResponse['toolsCalled'] = [];
  const logs: McpLogEntry[] = [];

  for (const intent of intents) {
    const start = performance.now();
    try {
      const result = await mcpCallTool(intent.tool, intent.args);
      const latencyMs = Math.round(performance.now() - start);
      const text = result.content?.[0]?.text || JSON.stringify(result);

      toolsCalled.push({ name: intent.tool, args: intent.args, result: text });
      logs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        method: `tools/call → ${intent.tool}`,
        params: intent.args,
        result: text.substring(0, 200),
        latencyMs,
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      const errorMsg = err.message || String(err);
      toolsCalled.push({ name: intent.tool, args: intent.args, result: `Error: ${errorMsg}` });
      logs.push({
        id: `log-${Date.now()}-err`,
        timestamp: new Date().toISOString(),
        method: `tools/call → ${intent.tool}`,
        params: intent.args,
        error: errorMsg,
        latencyMs,
      });
    }
  }

  const speech = synthesizeSpeech(prompt, toolsCalled);

  return { speech, toolsCalled, logs };
}
