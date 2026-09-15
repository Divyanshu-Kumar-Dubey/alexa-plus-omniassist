/**
 * Virtual IoT and Smart Home Environment State Engine
 * Simulates connected Amazon Echo, Ring, Fire TV, and Smart Home peripherals.
 */

export interface DeviceState {
  id: string;
  name: string;
  category: 'lighting' | 'climate' | 'security' | 'media' | 'camera';
  room: string;
  status: 'online' | 'offline';
  state: Record<string, any>;
  lastUpdated: string;
}

export interface SmartRoutine {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  active: boolean;
  lastExecuted?: string;
}

export interface AmbientMetrics {
  indoorTemperature: number; // in °F
  targetTemperature: number;
  humidity: number; // in %
  airQualityIndex: number; // 0-500 (good <= 50)
  noiseLevelDb: number;
  motionDetected: boolean;
}

class HomeStateManager {
  private devices: Map<string, DeviceState> = new Map();
  private routines: SmartRoutine[] = [];
  private ambient: AmbientMetrics = {
    indoorTemperature: 71,
    targetTemperature: 71,
    humidity: 45,
    airQualityIndex: 28,
    noiseLevelDb: 38,
    motionDetected: false,
  };
  private executionLog: Array<{
    timestamp: string;
    action: string;
    source: string;
    details: any;
  }> = [];

  constructor() {
    this.initDefaultDevices();
  }

  private initDefaultDevices() {
    const initialDevices: DeviceState[] = [
      {
        id: 'light_living_room',
        name: 'Living Room Overhead Light',
        category: 'lighting',
        room: 'Living Room',
        status: 'online',
        state: { power: true, brightness: 75, colorHex: '#FFE4B5', colorTemp: 'warm' },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'light_kitchen',
        name: 'Kitchen Pendant Lights',
        category: 'lighting',
        room: 'Kitchen',
        status: 'online',
        state: { power: false, brightness: 50, colorHex: '#FFFFFF', colorTemp: 'cool' },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'light_bedroom',
        name: 'Bedroom Ambient Light',
        category: 'lighting',
        room: 'Bedroom',
        status: 'online',
        state: { power: false, brightness: 30, colorHex: '#8A2BE2', colorTemp: 'violet' },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'thermostat_main',
        name: 'Ecobee / Amazon Smart Thermostat',
        category: 'climate',
        room: 'Hallway',
        status: 'online',
        state: { currentTemp: 71, targetTemp: 71, mode: 'auto', fan: 'auto' },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'lock_front_door',
        name: 'Front Door Smart Deadbolt',
        category: 'security',
        room: 'Entrance',
        status: 'online',
        state: { locked: true, battery: 94 },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'camera_front_door',
        name: 'Ring Video Doorbell Pro',
        category: 'camera',
        room: 'Front Porch',
        status: 'online',
        state: {
          streaming: true,
          lastEvent: 'Package delivered at 11:20 AM',
          motionRecent: false,
          battery: 100,
        },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'fire_tv_living_room',
        name: 'Fire TV Omni Series',
        category: 'media',
        room: 'Living Room',
        status: 'online',
        state: { power: false, app: 'Prime Video', volume: 24, playing: false },
        lastUpdated: new Date().toISOString(),
      },
    ];

    for (const d of initialDevices) {
      this.devices.set(d.id, d);
    }

    this.routines = [
      {
        id: 'routine_good_morning',
        name: 'Good Morning',
        trigger: 'Voice / 7:00 AM',
        actions: [
          'Set kitchen lights to 80%',
          'Adjust thermostat to 72°F',
          'Read morning news briefing & weather',
        ],
        active: true,
      },
      {
        id: 'routine_movie_night',
        name: 'Movie Night',
        trigger: 'Voice / "Alexa, Movie Night"',
        actions: [
          'Dim living room lights to 20% warm',
          'Turn on Fire TV to Prime Video',
          'Lock front door',
        ],
        active: true,
      },
      {
        id: 'routine_away_mode',
        name: 'Away & Secure',
        trigger: 'Voice / "Alexa, Goodbye"',
        actions: [
          'Turn off all lights',
          'Lock all doors',
          'Arm Ring security system',
          'Set thermostat to eco mode (68°F)',
        ],
        active: true,
      },
    ];
  }

  public getDevices(): DeviceState[] {
    return Array.from(this.devices.values());
  }

  public getDevice(id: string): DeviceState | undefined {
    return this.devices.get(id);
  }

  public updateDeviceState(id: string, updates: Record<string, any>): DeviceState | null {
    const dev = this.devices.get(id);
    if (!dev) return null;

    dev.state = { ...dev.state, ...updates };
    dev.lastUpdated = new Date().toISOString();

    this.logAction(`Updated device ${dev.name}`, 'MCP_TOOL', updates);
    return dev;
  }

  public findDeviceByRoomOrName(query: string): DeviceState | undefined {
    const q = query.toLowerCase();
    for (const d of this.devices.values()) {
      if (
        d.id.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.room.toLowerCase().includes(q)
      ) {
        return d;
      }
    }
    return undefined;
  }

  public getAmbientMetrics(): AmbientMetrics {
    return { ...this.ambient };
  }

  public updateAmbientMetrics(updates: Partial<AmbientMetrics>) {
    this.ambient = { ...this.ambient, ...updates };
  }

  public getRoutines(): SmartRoutine[] {
    return [...this.routines];
  }

  public addRoutine(routine: Omit<SmartRoutine, 'id' | 'active'>): SmartRoutine {
    const newRoutine: SmartRoutine = {
      id: `routine_${Date.now()}`,
      ...routine,
      active: true,
    };
    this.routines.push(newRoutine);
    this.logAction(`Created routine ${newRoutine.name}`, 'MCP_TOOL', newRoutine);
    return newRoutine;
  }

  public triggerRoutine(routineName: string): { success: boolean; executedActions: string[] } {
    const routine = this.routines.find((r) =>
      r.name.toLowerCase().includes(routineName.toLowerCase())
    );
    if (!routine) return { success: false, executedActions: [] };

    routine.lastExecuted = new Date().toISOString();

    // Execute effects based on routine
    if (routine.name.toLowerCase().includes('movie')) {
      this.updateDeviceState('light_living_room', { power: true, brightness: 20, colorHex: '#FFA07A' });
      this.updateDeviceState('fire_tv_living_room', { power: true, playing: true });
      this.updateDeviceState('lock_front_door', { locked: true });
    } else if (routine.name.toLowerCase().includes('morning')) {
      this.updateDeviceState('light_kitchen', { power: true, brightness: 80, colorHex: '#FFFFFF' });
      this.updateDeviceState('thermostat_main', { targetTemp: 72 });
    } else if (routine.name.toLowerCase().includes('away')) {
      this.updateDeviceState('light_living_room', { power: false });
      this.updateDeviceState('light_kitchen', { power: false });
      this.updateDeviceState('light_bedroom', { power: false });
      this.updateDeviceState('lock_front_door', { locked: true });
    }

    this.logAction(`Triggered routine ${routine.name}`, 'MCP_TOOL', { routineId: routine.id });
    return { success: true, executedActions: routine.actions };
  }

  public logAction(action: string, source: string, details: any) {
    this.executionLog.unshift({
      timestamp: new Date().toISOString(),
      action,
      source,
      details,
    });
    if (this.executionLog.length > 50) this.executionLog.pop();
  }

  public getExecutionLog() {
    return [...this.executionLog];
  }

  public getFullSnapshot() {
    return {
      devices: this.getDevices(),
      ambient: this.getAmbientMetrics(),
      routines: this.getRoutines(),
      recentLogs: this.executionLog.slice(0, 10),
    };
  }
}

export const homeState = new HomeStateManager();
