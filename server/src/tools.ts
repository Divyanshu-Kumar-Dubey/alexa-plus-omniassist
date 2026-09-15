/**
 * Model Context Protocol (MCP) Tool Registrations and Handlers
 * Compliant with MCP Specification 2025-11-25.
 */

import { homeState } from './state';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export const registeredTools: McpToolDefinition[] = [
  {
    name: 'smart_home_control',
    description:
      'Control smart home devices across lighting, climate, locks, and appliances. Supports on/off, brightness, colors, and temperature setpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Target room or device name (e.g. "living room lights", "kitchen", "front door lock", "thermostat")',
        },
        action: {
          type: 'string',
          enum: [
            'turn_on',
            'turn_off',
            'set_brightness',
            'set_color',
            'set_temperature',
            'lock',
            'unlock',
          ],
          description: 'The operation to perform on the target device.',
        },
        value: {
          type: 'string',
          description:
            'Optional parameter value (e.g. brightness "80", color "#FF5733" or "warm white", temp "72")',
        },
      },
      required: ['target', 'action'],
    },
  },
  {
    name: 'iot_camera_query',
    description:
      'Inspect simulated Ring Video Doorbells or security cameras for live activity, recent motion events, or package deliveries.',
    inputSchema: {
      type: 'object',
      properties: {
        cameraId: {
          type: 'string',
          description: 'Camera identifier (e.g. "camera_front_door" or "front porch")',
        },
        queryType: {
          type: 'string',
          enum: ['live_snapshot', 'recent_events', 'motion_check', 'package_detection'],
          description: 'Type of query to run on the camera feed.',
        },
      },
      required: ['cameraId'],
    },
  },
  {
    name: 'schedule_smart_routine',
    description:
      'Create or immediately trigger automated smart home routines (e.g. "Good Morning", "Movie Night", "Away Mode").',
    inputSchema: {
      type: 'object',
      properties: {
        routineName: {
          type: 'string',
          description: 'The name of the routine to trigger or create.',
        },
        triggerNow: {
          type: 'boolean',
          description: 'Whether to trigger and execute the routine immediately.',
        },
        actions: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of actions to associate with the routine if creating a new one.',
        },
      },
      required: ['routineName'],
    },
  },
  {
    name: 'personal_concierge_query',
    description:
      'Access personal intelligence: upcoming calendar meetings, flight statuses, commute traffic ETAs, and smart grocery replenishment items.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['calendar', 'flights', 'traffic', 'grocery', 'reminders'],
          description: 'The personal domain to query.',
        },
        detailQuery: {
          type: 'string',
          description: 'Specific question or filter (e.g. "today\'s schedule", "traffic to airport")',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'weather_air_quality',
    description:
      'Retrieve environmental telemetry from smart home sensors including indoor/outdoor temperature, humidity, and Air Quality Index (AQI).',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['indoor_sensors', 'local_weather', 'full_diagnostic'],
          description: 'Scope of environmental metrics to fetch.',
        },
      },
    },
  },
  {
    name: 'execute_media_action',
    description:
      'Control Fire TV or connected Echo speakers: launch media apps, play/pause video, adjust volume.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'set_volume', 'launch_app'],
          description: 'Media playback action.',
        },
        mediaTitle: {
          type: 'string',
          description: 'Title or app name (e.g. "Prime Video", "Lord of the Rings")',
        },
        volumeLevel: {
          type: 'number',
          description: 'Volume level from 0 to 100.',
        },
      },
      required: ['action'],
    },
  },
];

export async function executeMcpTool(
  name: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  switch (name) {
    case 'smart_home_control': {
      const { target, action, value } = args;
      const device = homeState.findDeviceByRoomOrName(target);

      if (!device) {
        // Fallback: If target mentions a room, update all lights or general room devices
        const isLight = target.toLowerCase().includes('light');
        const isThermostat = target.toLowerCase().includes('thermostat') || target.toLowerCase().includes('temp');

        if (isThermostat) {
          const tempVal = parseInt(value || '72', 10);
          homeState.updateDeviceState('thermostat_main', { targetTemp: tempVal });
          return {
            content: [
              {
                type: 'text',
                text: `[MCP:smart_home_control] Successfully adjusted Smart Thermostat target temperature to ${tempVal}°F.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `[MCP:smart_home_control] Device "${target}" not directly found. Available devices: ${homeState
                .getDevices()
                .map((d) => d.name)
                .join(', ')}.`,
            },
          ],
          isError: true,
        };
      }

      // Execute based on device category and action
      let feedback = '';
      if (action === 'turn_on') {
        homeState.updateDeviceState(device.id, { power: true });
        feedback = `${device.name} in ${device.room} is now powered ON.`;
      } else if (action === 'turn_off') {
        homeState.updateDeviceState(device.id, { power: false });
        feedback = `${device.name} in ${device.room} is now powered OFF.`;
      } else if (action === 'set_brightness') {
        const b = Math.min(100, Math.max(0, parseInt(value || '50', 10)));
        homeState.updateDeviceState(device.id, { power: true, brightness: b });
        feedback = `${device.name} brightness adjusted to ${b}%.`;
      } else if (action === 'set_color') {
        const color = value || '#FFA07A';
        homeState.updateDeviceState(device.id, { power: true, colorHex: color });
        feedback = `${device.name} color set to ${color}.`;
      } else if (action === 'set_temperature') {
        const temp = parseInt(value || '72', 10);
        homeState.updateDeviceState(device.id, { targetTemp: temp });
        feedback = `${device.name} target temperature set to ${temp}°F.`;
      } else if (action === 'lock') {
        homeState.updateDeviceState(device.id, { locked: true });
        feedback = `${device.name} has been securely LOCKED.`;
      } else if (action === 'unlock') {
        homeState.updateDeviceState(device.id, { locked: false });
        feedback = `${device.name} has been UNLOCKED.`;
      } else {
        feedback = `Action ${action} completed on ${device.name}.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:smart_home_control] Success: ${feedback}`,
          },
        ],
      };
    }

    case 'iot_camera_query': {
      const { queryType } = args;
      const cam = homeState.getDevice('camera_front_door');

      const snapshotInfo = {
        camera: cam?.name || 'Ring Video Doorbell Pro',
        status: 'Online (1080p HDR Live Stream)',
        battery: '100% (Hardwired)',
        lastEvent: cam?.state.lastEvent || 'Package detected on porch at 11:20 AM',
        recentMotion: 'No motion detected in the last 15 minutes',
        visionAnalysis:
          'Clear porch view. 1 Amazon Prime delivery box sitting safely beside the front door. Weather conditions sunny and clear.',
      };

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:iot_camera_query] Camera Report (${queryType || 'live_snapshot'}):\n${JSON.stringify(
              snapshotInfo,
              null,
              2
            )}`,
          },
        ],
      };
    }

    case 'schedule_smart_routine': {
      const { routineName, triggerNow, actions } = args;

      if (triggerNow) {
        const result = homeState.triggerRoutine(routineName);
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `[MCP:schedule_smart_routine] Activated routine "${routineName}". Executed actions:\n- ${result.executedActions.join(
                  '\n- '
                )}`,
              },
            ],
          };
        }
      }

      // If routine didn't exist or creating a new one
      const created = homeState.addRoutine({
        name: routineName,
        trigger: 'Voice / Scheduled',
        actions: actions || ['Adjust ambiance', 'Notify user'],
      });

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:schedule_smart_routine] Created new smart routine "${created.name}" with ${created.actions.length} automated steps.`,
          },
        ],
      };
    }

    case 'personal_concierge_query': {
      const { category } = args;
      let reply = '';

      if (category === 'calendar') {
        reply =
          'Upcoming schedule for today:\n• 10:00 AM: Amazon Developer Hackathon Sync\n• 1:30 PM: Product Demo Architecture Review\n• 4:00 PM: Focus Time - Alexa+ & MCP Streamable HTTP development';
      } else if (category === 'traffic') {
        reply =
          'Commute to Downtown Seattle: 24 mins via I-5 S (Normal flow, 3 mins faster than usual).';
      } else if (category === 'grocery') {
        reply =
          'Amazon Fresh Smart Reorder List:\n• Organic Almond Milk (Low in fridge)\n• Espresso Beans (Replenishment scheduled for Thursday)\n• Fresh Avocados (Added to cart)';
      } else if (category === 'flights') {
        reply =
          'Flight UA 1422 (SEA -> SFO): On time. Departure Gate B7 at 6:45 PM tomorrow.';
      } else {
        reply = 'Personal Concierge active. 3 pending reminders and 1 active shipment on track.';
      }

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:personal_concierge_query] Category: ${category}\n${reply}`,
          },
        ],
      };
    }

    case 'weather_air_quality': {
      const ambient = homeState.getAmbientMetrics();
      const report = {
        indoorClimate: {
          temperature: `${ambient.indoorTemperature}°F`,
          target: `${ambient.targetTemperature}°F`,
          humidity: `${ambient.humidity}%`,
          airQualityIndex: `${ambient.airQualityIndex} AQI (Excellent)`,
        },
        outdoorForecast: {
          condition: 'Partly Cloudy',
          temperature: '68°F',
          high: '74°F',
          low: '55°F',
          precipitationChance: '10%',
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:weather_air_quality] Ambient Sensor & Forecast Report:\n${JSON.stringify(
              report,
              null,
              2
            )}`,
          },
        ],
      };
    }

    case 'execute_media_action': {
      const { action, mediaTitle, volumeLevel } = args;
      const tv = homeState.getDevice('fire_tv_living_room');

      if (action === 'launch_app') {
        homeState.updateDeviceState('fire_tv_living_room', {
          power: true,
          app: mediaTitle || 'Prime Video',
          playing: true,
        });
      } else if (action === 'play') {
        homeState.updateDeviceState('fire_tv_living_room', { power: true, playing: true });
      } else if (action === 'pause') {
        homeState.updateDeviceState('fire_tv_living_room', { playing: false });
      } else if (action === 'set_volume' && typeof volumeLevel === 'number') {
        homeState.updateDeviceState('fire_tv_living_room', { volume: volumeLevel });
      }

      return {
        content: [
          {
            type: 'text',
            text: `[MCP:execute_media_action] Fire TV action "${action}" executed. Current media state: ${
              tv?.state.app || 'Prime Video'
            } (Playing: ${action !== 'pause'}).`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown MCP tool: ${name}` }],
        isError: true,
      };
  }
}
