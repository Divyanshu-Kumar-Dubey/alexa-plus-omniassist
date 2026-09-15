import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { mcpGetState, mcpSubscribeSSE, mcpCallTool, McpLogEntry } from './services/mcpClient';
import { runAgentLoop, AgentResponse } from './services/agentEngine';

interface DeviceState {
  id: string;
  name: string;
  category: string;
  room: string;
  status: string;
  state: Record<string, any>;
}

const QUICK_ACTIONS = [
  { icon: '🎬', label: 'Movie Night', command: 'Activate Movie Night' },
  { icon: '🌅', label: 'Good Morning', command: 'Good morning routine' },
  { icon: '🔒', label: 'Lock Front Door', command: 'Lock the front door' },
  { icon: '📷', label: 'Check Ring Feed', command: 'Check Ring camera' },
  { icon: '❄️', label: 'Set AC to 71°F', command: 'Set thermostat to 71 degrees' },
  { icon: '💡', label: 'Relax Lighting', command: 'Set living room lights to warm candle 30%' },
  { icon: '📅', label: 'Today\'s Agenda', command: "What's on my calendar today?" },
  { icon: '🌤️', label: 'Air & Weather', command: 'Weather and air quality report' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Devices' },
  { id: 'lighting', label: 'Lights' },
  { id: 'climate', label: 'Climate' },
  { id: 'security', label: 'Security' },
  { id: 'camera', label: 'Cameras' },
  { id: 'media', label: 'Entertainment' },
];

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [ambient, setAmbient] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [alexaResponse, setAlexaResponse] = useState<AgentResponse | null>(null);
  const [mcpLogs, setMcpLogs] = useState<McpLogEntry[]>([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'calls' | 'results'>('all');
  const [ringSnapshotTime, setRingSnapshotTime] = useState('11:20 AM');

  const inputRef = useRef<HTMLInputElement>(null);
  const consoleFeedRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initial State Fetch & Real-Time SSE Subscription
  useEffect(() => {
    mcpGetState()
      .then((snapshot) => {
        setDevices(snapshot.devices || []);
        setAmbient(snapshot.ambient || null);
        setServerOnline(true);
      })
      .catch(() => setServerOnline(false));

    const unsubscribe = mcpSubscribeSSE((event, data) => {
      if (event === 'connected') {
        setServerOnline(true);
        if (data.snapshot) {
          setDevices(data.snapshot.devices || []);
          setAmbient(data.snapshot.ambient || null);
        }
      }
      if (event === 'state_change' && data.snapshot) {
        setDevices(data.snapshot.devices || []);
        setAmbient(data.snapshot.ambient || null);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-scroll console container internally without scrolling the browser window
  useEffect(() => {
    if (consoleFeedRef.current) {
      consoleFeedRef.current.scrollTop = consoleFeedRef.current.scrollHeight;
    }
  }, [mcpLogs]);

  // High Quality Web Speech Synthesis
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.name.includes('Samantha') ||
        v.name.includes('Google US English') ||
        v.name.includes('Natural') ||
        v.name.includes('Zira')
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Core Agent Loop Execution
  const handleCommand = useCallback(
    async (textToRun?: string) => {
      const query = (textToRun || prompt).trim();
      if (!query || isProcessing) return;

      setPrompt('');
      setIsProcessing(true);
      setAlexaResponse(null);

      try {
        const response = await runAgentLoop(query);
        setAlexaResponse(response);
        setMcpLogs((prev) => [...prev, ...response.logs].slice(-50));

        // Refresh snapshot
        const snapshot = await mcpGetState();
        setDevices(snapshot.devices || []);
        setAmbient(snapshot.ambient || null);

        // Vocalize response
        speak(response.speech);
      } catch (err: any) {
        setAlexaResponse({
          speech: `I encountered an issue connecting to the home hub: ${err.message || 'Server offline'}.`,
          toolsCalled: [],
          logs: [],
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [prompt, isProcessing, speak]
  );

  // Interactive Device Direct Control (Calls MCP Tool)
  const handleDeviceToggle = useCallback(
    async (device: DeviceState) => {
      const start = performance.now();

      if (device.category === 'lighting') {
        // Use smart_home_control with correct 'target' param and turn_on/turn_off
        const action = device.state.power ? 'turn_off' : 'turn_on';
        const args = { target: device.name, action };
        try {
          const result = await mcpCallTool('smart_home_control', args);
          const latencyMs = Math.round(performance.now() - start);
          setMcpLogs((prev) => [
            ...prev,
            {
              id: `manual_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              method: 'tools/call (Direct Control)',
              params: { name: 'smart_home_control', arguments: args },
              result: JSON.stringify(result),
              latencyMs,
            },
          ]);
          const snapshot = await mcpGetState();
          setDevices(snapshot.devices || []);
        } catch (e) {
          console.error('Direct device control error:', e);
        }
      } else if (device.category === 'security') {
        const action = device.state.locked ? 'unlock' : 'lock';
        const args = { target: device.name, action };
        try {
          const result = await mcpCallTool('smart_home_control', args);
          const latencyMs = Math.round(performance.now() - start);
          setMcpLogs((prev) => [
            ...prev,
            {
              id: `manual_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              method: 'tools/call (Direct Control)',
              params: { name: 'smart_home_control', arguments: args },
              result: JSON.stringify(result),
              latencyMs,
            },
          ]);
          const snapshot = await mcpGetState();
          setDevices(snapshot.devices || []);
        } catch (e) {
          console.error('Direct device control error:', e);
        }
      } else if (device.category === 'media') {
        // Use execute_media_action for media devices
        const action = device.state.playing ? 'pause' : 'play';
        const args = { action };
        try {
          const result = await mcpCallTool('execute_media_action', args);
          const latencyMs = Math.round(performance.now() - start);
          setMcpLogs((prev) => [
            ...prev,
            {
              id: `manual_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              method: 'tools/call (Direct Control)',
              params: { name: 'execute_media_action', arguments: args },
              result: JSON.stringify(result),
              latencyMs,
            },
          ]);
          const snapshot = await mcpGetState();
          setDevices(snapshot.devices || []);
        } catch (e) {
          console.error('Direct device control error:', e);
        }
      }
    },
    []
  );

  // Quick Temp Adjust
  const handleTempAdjust = useCallback(async (delta: number, currentTemp: number) => {
    const newTemp = currentTemp + delta;
    try {
      await mcpCallTool('smart_home_control', {
        target: 'thermostat',
        action: 'set_temperature',
        value: String(newTemp),
      });
      const snapshot = await mcpGetState();
      setDevices(snapshot.devices || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Instant Ring Snapshot
  const handleTriggerSnapshot = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await mcpCallTool('iot_camera_query', { cameraId: 'camera_front_door', queryType: 'live_snapshot' });
      const latencyMs = Math.round(performance.now() - start);
      setRingSnapshotTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setMcpLogs((prev) => [
        ...prev,
        {
          id: `cam_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          method: 'tools/call',
          params: { name: 'iot_camera_query', arguments: { cameraId: 'camera_front_door', queryType: 'live_snapshot' } },
          result: JSON.stringify(res),
          latencyMs,
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Web Speech API Voice Recognition
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is supported in modern Chrome and Edge browsers.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setPrompt(text);
      setIsListening(false);
      setTimeout(() => handleCommand(text), 350);
    };

    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening, handleCommand]);

  // Dynamic Audio Spectrum Waveform Bars
  const spectrumBars = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const active = isListening || isSpeaking || isProcessing;
      if (!active) {
        return 4 + Math.sin(i * 0.45) * 3;
      }
      if (isListening) {
        return 8 + Math.random() * 26;
      }
      if (isProcessing) {
        return 6 + Math.abs(Math.sin((i + Date.now() / 200) * 0.5)) * 18;
      }
      // isSpeaking
      return 10 + Math.random() * 32;
    });
  }, [isListening, isSpeaking, isProcessing]);

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    if (activeCategory === 'all') return devices;
    return devices.filter((d) => d.category === activeCategory);
  }, [devices, activeCategory]);

  // Filtered MCP Logs
  const filteredLogs = useMemo(() => {
    if (consoleFilter === 'calls') return mcpLogs.filter((l) => l.params);
    if (consoleFilter === 'results') return mcpLogs.filter((l) => l.result);
    return mcpLogs;
  }, [mcpLogs, consoleFilter]);

  const ringClass = isListening
    ? 'listening'
    : isProcessing
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : '';

  return (
    <>
      {/* Ambient Moving Aurora Background */}
      <div className="ambient-aurora-bg">
        <div className="aurora-sphere aurora-1" />
        <div className="aurora-sphere aurora-2" />
        <div className="aurora-sphere aurora-3" />
        <div className="tech-grid-overlay" />
      </div>

      {/* Frosted Luxury Top Navbar */}
      <header className="app-navbar">
        <div className="navbar-inner">
          <div className="brand-group">
            <div className="alexa-orb-logo" />
            <span className="brand-text">
              OmniAssist <span className="brand-plus-tag">ALEXA+</span>
            </span>
          </div>

          <div className="header-badges">
            <div className="badge-pill">
              <span className={`status-beacon ${serverOnline ? 'online' : ''}`} />
              <span>MCP Server {serverOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div className="badge-pill">
              <span style={{ color: 'var(--alexa-cyan)' }}>●</span>
              <span>{devices.length} Devices Active</span>
            </div>

            <a
              href="https://github.com/Divyanshu-Kumar-Dubey/alexa-plus-omniassist"
              target="_blank"
              rel="noreferrer"
              className="nav-link-btn"
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>

            <a
              href="http://localhost:3001/health"
              target="_blank"
              rel="noreferrer"
              className="nav-link-btn"
              style={{ borderColor: 'var(--alexa-cyan)' }}
            >
              ⚡ Inspector API
            </a>
          </div>
        </div>
      </header>

      {/* Main Application Container */}
      <main className="app-main">
        {/* Hero Interactive Command Stage */}
        <section className="hero-command-zone glass-card">
          <div className="hackathon-chip">
            <span>🏆 Amazon Developer Hackathon 2026</span>
            <span>&bull;</span>
            <span>Alexa+ Track</span>
            <span>&bull;</span>
            <span>AWS Builder & Open Source</span>
          </div>

          <h1 className="hero-headline">
            Ambient Intelligence for your <span className="text-gradient">Smart Home</span>
          </h1>

          <p className="hero-subheadline">
            Experience next-generation Alexa+ orchestration. Powered by the <strong>Model Context Protocol (MCP 2025-11-25)</strong> over Streamable HTTP and intelligent multimodal feedback.
          </p>

          {/* Central Alexa Orb & Microphone Trigger */}
          <div className="alexa-interactive-stage">
            <div className={`alexa-halo-ring ${ringClass}`} onClick={toggleVoice} title="Click to speak with Alexa+">
              <div className="ring-layer-1" />
              <div className="ring-layer-2" />
              <button className="ring-core-button">
                <svg className="mic-svg-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            </div>

            {/* Audio Spectrum Frequency Canvas */}
            <div className="audio-spectrum-canvas">
              {spectrumBars.map((h, i) => (
                <div
                  key={i}
                  className="spectrum-bar"
                  style={{
                    height: `${h}px`,
                    opacity: isListening || isSpeaking || isProcessing ? 0.95 : 0.25,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Frosted Command Input Form */}
          <form
            className="prompt-control-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleCommand();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="prompt-text-field"
              placeholder={
                isListening
                  ? 'Listening to your voice...'
                  : isProcessing
                  ? 'Alexa is reasoning through MCP tools...'
                  : 'Ask Alexa anything (e.g., "Dim living room lights and lock front door")'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isProcessing}
            />
            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '8px',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="prompt-action-btn"
              disabled={isProcessing || !prompt.trim()}
            >
              {isProcessing ? 'Thinking...' : 'Send Prompt ↵'}
            </button>
          </form>

          {/* Quick Action Interactive Chips */}
          <div className="quick-action-ribbon">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="action-chip-pill"
                onClick={() => handleCommand(action.command)}
                disabled={isProcessing}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Alexa Response Multimodal Speech Bubble */}
        {alexaResponse && (
          <div className="alexa-dialog-container glass-card">
            <div className="dialog-header">
              <div className="dialog-avatar-group">
                <div className="alexa-mini-orb" />
                <span className="dialog-title">Alexa+ Multimodal Concierge</span>
              </div>
              {alexaResponse.toolsCalled.length > 0 && (
                <div className="tool-count-badge">
                  <span>⚡</span>
                  <span>{alexaResponse.toolsCalled.length} MCP Tool{alexaResponse.toolsCalled.length > 1 ? 's' : ''} Executed</span>
                </div>
              )}
            </div>

            <div className="dialog-bubble-body">
              {alexaResponse.speech}
            </div>

            {alexaResponse.toolsCalled.length > 0 && (
              <div className="tool-telemetry-tray">
                {alexaResponse.toolsCalled.map((tc, idx) => (
                  <div key={idx} className="tool-pill-record">
                    <span className="tool-name-tag">{tc.name}()</span>
                    <span className="tool-args-tag">{JSON.stringify(tc.args)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ambient Sensor Telemetry Strip */}
        {ambient && (
          <div>
            <div className="section-title-bar">
              <h2 className="section-heading">
                <span>🌡️</span> Ambient Environmental Telemetry
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Indoor Multimodal Sensing
              </span>
            </div>
            <div className="ambient-sensor-deck">
              <div className="sensor-metric-card glass-card">
                <span className="sensor-card-label">🌡️ Indoor Temp</span>
                <span className="sensor-card-value">{ambient.indoorTemperature}°F</span>
                <span style={{ fontSize: '12px', color: 'var(--status-emerald)' }}>Optimal Comfort</span>
              </div>
              <div className="sensor-metric-card glass-card">
                <span className="sensor-card-label">💧 Relative Humidity</span>
                <span className="sensor-card-value">{ambient.humidity}%</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Balanced Zone</span>
              </div>
              <div className="sensor-metric-card glass-card">
                <span className="sensor-card-label">🍃 Air Quality</span>
                <span
                  className="sensor-card-value"
                  style={{
                    color:
                      ambient.airQualityIndex <= 50
                        ? 'var(--status-emerald)'
                        : 'var(--status-amber)',
                  }}
                >
                  {ambient.airQualityIndex} AQI
                </span>
                <span style={{ fontSize: '12px', color: 'var(--status-emerald)' }}>Clean & Filtered</span>
              </div>
              <div className="sensor-metric-card glass-card">
                <span className="sensor-card-label">🔊 Ambient Sound</span>
                <span className="sensor-card-value">{ambient.noiseLevelDb} dB</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quiet Environment</span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Main Grid Split */}
        <div className="dashboard-main-split">
          {/* Left Column: Device Control Center */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <div className="section-title-bar">
                <h2 className="section-heading">
                  <span>🏠</span> Connected Home Devices
                </h2>
                <div className="category-filter-strip">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      className={`category-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="devices-mesh-grid">
                {filteredDevices.map((d) => {
                  const isActive =
                    d.state.power === true ||
                    d.state.locked === true ||
                    d.state.streaming === true;

                  return (
                    <div
                      key={d.id}
                      className={`glass-card device-tile ${isActive ? 'active' : ''}`}
                    >
                      <div className="device-tile-top">
                        <div className="device-icon-frame">
                          {d.category === 'lighting' && '💡'}
                          {d.category === 'climate' && '🌡️'}
                          {d.category === 'security' && '🔒'}
                          {d.category === 'camera' && '📹'}
                          {d.category === 'media' && '📺'}
                        </div>
                        <span className={`status-beacon ${d.status === 'online' ? 'online' : ''}`} />
                      </div>

                      <div className="device-info-block">
                        <span className="device-card-room">{d.room}</span>
                        <h3 className="device-card-name">{d.name}</h3>
                      </div>

                      <div className="device-action-zone">
                        {/* Lighting Controls */}
                        {d.category === 'lighting' && (
                          <>
                            <div className="range-slider-wrap">
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {d.state.brightness}%
                              </span>
                              {d.state.colorHex && (
                                <span
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    backgroundColor: d.state.colorHex,
                                    boxShadow: `0 0 8px ${d.state.colorHex}`,
                                    display: 'inline-block',
                                  }}
                                />
                              )}
                            </div>
                            <label className="switch-container">
                              <input
                                type="checkbox"
                                checked={d.state.power || false}
                                onChange={() => handleDeviceToggle(d)}
                              />
                              <span className="switch-track" />
                            </label>
                          </>
                        )}

                        {/* Climate Controls */}
                        {d.category === 'climate' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--alexa-cyan)' }}>
                                {d.state.targetTemp}°F
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 6 }}>
                                ({d.state.mode})
                              </span>
                            </div>
                            <div className="temp-adjuster">
                              <button className="temp-btn" onClick={() => handleTempAdjust(-1, d.state.targetTemp)} title="Decrease">
                                −
                              </button>
                              <button className="temp-btn" onClick={() => handleTempAdjust(1, d.state.targetTemp)} title="Increase">
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Security Controls */}
                        {d.category === 'security' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: d.state.locked ? 'var(--status-emerald)' : 'var(--status-amber)',
                              }}
                            >
                              {d.state.locked ? 'Locked' : 'Unlocked'}
                            </span>
                            <button
                              className="nav-link-btn"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => handleDeviceToggle(d)}
                            >
                              {d.state.locked ? 'Unlock' : 'Lock'}
                            </button>
                          </div>
                        )}

                        {/* Media Controls */}
                        {d.category === 'media' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Vol {d.state.volume} &bull; {d.state.playing ? 'Playing' : 'Paused'}
                            </span>
                            <button
                              className="nav-link-btn"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => handleDeviceToggle(d)}
                            >
                              {d.state.playing ? 'Pause' : 'Play'}
                            </button>
                          </div>
                        )}

                        {/* Camera Controls */}
                        {d.category === 'camera' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Motion Sensor Active
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--alexa-cyan)' }}>
                              1080p HDR
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Cinematic Ring Doorbell Live View Widget */}
                <div className="ring-hud-card">
                  <div className="ring-hud-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="live-beacon-tag">
                        <span className="dot" /> LIVE FEED
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        Ring Doorbell Pro &bull; Front Porch
                      </span>
                    </div>
                    <button
                      className="nav-link-btn"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={handleTriggerSnapshot}
                    >
                      📸 Snapshot Now
                    </button>
                  </div>

                  <div className="camera-screen-viewport">
                    <div className="scanline-sweep" />
                    <div className="hud-target-box">
                      <span style={{ fontSize: '38px', filter: 'drop-shadow(0 0 10px rgba(0,202,255,0.4))' }}>
                        🚪
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--alexa-cyan)', fontWeight: 600 }}>
                        Front Entryway Monitored
                      </span>
                    </div>
                  </div>

                  <div className="camera-screen-footer">
                    <span>📦 Last Motion Event: Package Delivered ({ringSnapshotTime})</span>
                    <span style={{ color: 'var(--status-emerald)' }}>● Cloud AI Stream Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Cyber MCP Console */}
          <aside className="mcp-cyber-console glass-card">
            <div className="console-topbar">
              <div className="console-title-group">
                <span className="console-pulse-indicator" />
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
                  MCP Streamable HTTP Inspector
                </h3>
              </div>
              <button
                className="nav-link-btn"
                style={{ padding: '2px 8px', fontSize: '11px' }}
                onClick={() => setMcpLogs([])}
                title="Clear packet history"
              >
                Clear
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ padding: '8px 16px', display: 'flex', gap: 6, borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
              <button
                className={`category-tab-btn ${consoleFilter === 'all' ? 'active' : ''}`}
                style={{ padding: '3px 10px', fontSize: '11px' }}
                onClick={() => setConsoleFilter('all')}
              >
                All ({mcpLogs.length})
              </button>
              <button
                className={`category-tab-btn ${consoleFilter === 'calls' ? 'active' : ''}`}
                style={{ padding: '3px 10px', fontSize: '11px' }}
                onClick={() => setConsoleFilter('calls')}
              >
                Tool Calls
              </button>
              <button
                className={`category-tab-btn ${consoleFilter === 'results' ? 'active' : ''}`}
                style={{ padding: '3px 10px', fontSize: '11px' }}
                onClick={() => setConsoleFilter('results')}
              >
                Results
              </button>
            </div>

            <div className="console-feed-window" ref={consoleFeedRef}>
              {filteredLogs.length === 0 ? (
                <div className="empty-console-state">
                  <span style={{ fontSize: '28px', opacity: 0.5 }}>⚡</span>
                  <span>No MCP packets captured yet. Speak or type a command to observe live JSON-RPC traffic.</span>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="mcp-event-box">
                    <div className="event-box-meta">
                      <span className="method-badge">{log.method}</span>
                      <span className="latency-pill">{log.latencyMs}ms</span>
                    </div>

                    {log.params && (
                      <div className="event-code-snippet">
                        <span style={{ color: 'var(--alexa-cyan)' }}>Req:</span> {JSON.stringify(log.params)}
                      </div>
                    )}

                    {log.result && (
                      <div className="event-code-snippet result">
                        <span style={{ color: '#86efac' }}>Res:</span> {log.result}
                      </div>
                    )}

                    {log.error && (
                      <div className="event-code-snippet error">
                        <span style={{ color: '#fca5a5' }}>Err:</span> {log.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
