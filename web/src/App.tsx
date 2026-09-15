import { useState, useEffect, useRef, useCallback } from 'react';
import { mcpGetState, mcpSubscribeSSE, McpLogEntry } from './services/mcpClient';
import { runAgentLoop, AgentResponse } from './services/agentEngine';

interface DeviceState {
  id: string;
  name: string;
  category: string;
  room: string;
  status: string;
  state: Record<string, any>;
}

const QUICK_PROMPTS = [
  { icon: '🌅', text: 'Good morning routine' },
  { icon: '🎬', text: 'Activate Movie Night' },
  { icon: '🔒', text: 'Lock the front door' },
  { icon: '📷', text: 'Check Ring camera' },
  { icon: '🌡️', text: 'Set thermostat to 72°F' },
  { icon: '💡', text: 'Dim living room lights to 40%' },
  { icon: '📅', text: "What's on my calendar today?" },
  { icon: '🌤️', text: 'Weather and air quality report' },
];

const DEVICE_ICONS: Record<string, string> = {
  lighting: '💡',
  climate: '🌡️',
  security: '🔒',
  camera: '📷',
  media: '📺',
};

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [ambient, setAmbient] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [alexaResponse, setAlexaResponse] = useState<AgentResponse | null>(null);
  const [mcpLogs, setMcpLogs] = useState<McpLogEntry[]>([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Fetch initial state & subscribe to SSE
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

  // Auto-scroll MCP log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mcpLogs]);

  // Speech synthesis helper
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    // Try to find a female English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Female'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Submit prompt to agent
  const handleSubmit = useCallback(async (text?: string) => {
    const q = (text || prompt).trim();
    if (!q || isProcessing) return;

    setPrompt('');
    setIsProcessing(true);
    setAlexaResponse(null);

    try {
      const response = await runAgentLoop(q);
      setAlexaResponse(response);
      setMcpLogs((prev) => [...prev, ...response.logs].slice(-30));

      // Refresh device state
      const snapshot = await mcpGetState();
      setDevices(snapshot.devices || []);
      setAmbient(snapshot.ambient || null);

      // Speak the response
      speak(response.speech);
    } catch (err: any) {
      setAlexaResponse({
        speech: `Sorry, something went wrong. ${err.message || 'Is the MCP server running?'}`,
        toolsCalled: [],
        logs: [],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, isProcessing, speak]);

  // Voice recognition
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
      setIsListening(false);
      // Auto-submit after voice
      setTimeout(() => handleSubmit(transcript), 300);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isListening, handleSubmit]);

  // Waveform bars
  const waveformBars = Array.from({ length: 24 }, (_, i) => {
    const active = isListening || isSpeaking || isProcessing;
    const h = active
      ? 6 + Math.random() * 28
      : 4 + Math.sin(i * 0.5) * 3;
    return h;
  });

  const micClass = isListening ? 'listening' : isProcessing ? 'thinking' : '';

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="alexa-orb-icon" />
          <div className="brand-title">
            OmniAssist <span className="plus-badge">ALEXA+</span>
          </div>
        </div>
        <div className="header-status-group">
          <div className="status-pill">
            <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`} />
            MCP Server {serverOnline ? 'Online' : 'Offline'}
          </div>
          <div className="status-pill">
            <span className="status-dot online" />
            {devices.length} Devices
          </div>
          <button className="btn-header accent" onClick={() => window.open('http://localhost:3001/health', '_blank')}>
            🔍 Inspector
          </button>
        </div>
      </header>

      <div className="main-container">
        {/* Hero / Voice Control Zone */}
        <section className="ambient-hero">
          <span className="hero-tag">🎯 Amazon Developer Hackathon 2026 &middot; Alexa+ Track</span>
          <h1 className="hero-title">Your Intelligent Home Concierge</h1>
          <p className="hero-subtitle">
            Speak or type a command. OmniAssist uses Model Context Protocol (MCP) over Streamable HTTP
            to orchestrate your smart home in real time.
          </p>

          <div className="voice-control-center">
            {/* Waveform */}
            <div className="waveform-container">
              {waveformBars.map((h, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{
                    height: `${h}px`,
                    opacity: (isListening || isSpeaking || isProcessing) ? 0.9 : 0.25,
                    transition: `height ${0.08 + Math.random() * 0.05}s ease`,
                  }}
                />
              ))}
            </div>

            {/* Mic Orb */}
            <button className={`mic-orb-button ${micClass}`} onClick={toggleVoice} title="Press to speak">
              <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>

            {/* Text Input */}
            <form className="prompt-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <input
                ref={inputRef}
                className="prompt-input"
                type="text"
                placeholder={isListening ? 'Listening...' : 'Ask Alexa anything...'}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isProcessing}
              />
              <button type="submit" className="prompt-submit-btn" disabled={isProcessing || !prompt.trim()}>
                {isProcessing ? '⏳' : '▶'} Send
              </button>
            </form>

            {/* Quick chips */}
            <div className="quick-chips-group">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.text}
                  className="quick-chip"
                  onClick={() => handleSubmit(qp.text)}
                  disabled={isProcessing}
                >
                  {qp.icon} {qp.text}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Alexa Response */}
            {alexaResponse && (
              <div className="glass-panel assistant-response-card">
                <div className="section-header">
                  <h3 className="section-title">💬 Alexa Response</h3>
                  {alexaResponse.toolsCalled.length > 0 && (
                    <span className="thought-process-pill">
                      🛠️ {alexaResponse.toolsCalled.length} tool{alexaResponse.toolsCalled.length > 1 ? 's' : ''} executed
                    </span>
                  )}
                </div>
                <div className="alexa-speech-bubble">{alexaResponse.speech}</div>
                {alexaResponse.toolsCalled.map((tc, i) => (
                  <div key={i} style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', padding: '4px 0' }}>
                    <span style={{ color: 'var(--alexa-cyan)' }}>{tc.name}</span>({JSON.stringify(tc.args)})
                  </div>
                ))}
              </div>
            )}

            {/* Device Grid */}
            <div>
              <div className="section-header">
                <h3 className="section-title">🏠 Connected Devices</h3>
              </div>
              <div className="devices-container">
                {devices.map((d) => {
                  const isActive = d.state.power === true || d.state.locked === true || d.state.streaming === true;
                  return (
                    <div key={d.id} className={`glass-panel device-card ${isActive ? 'active' : ''}`}>
                      <div className="device-card-top">
                        <div className="device-icon-box">
                          <span style={{ fontSize: '22px' }}>{DEVICE_ICONS[d.category] || '📱'}</span>
                        </div>
                        <span className={`status-dot ${d.status === 'online' ? 'online' : 'offline'}`} />
                      </div>
                      <div>
                        <div className="device-name">{d.name}</div>
                        <div className="device-room">{d.room}</div>
                      </div>
                      <div className="device-controls">
                        {d.category === 'lighting' && (
                          <>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {d.state.brightness}%
                            </span>
                            {d.state.colorHex && (
                              <span style={{
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: d.state.colorHex,
                                border: '2px solid rgba(255,255,255,0.2)',
                                display: 'inline-block',
                              }} />
                            )}
                            <label className="toggle-switch">
                              <input type="checkbox" checked={d.state.power || false} readOnly />
                              <span className="slider-round" />
                            </label>
                          </>
                        )}
                        {d.category === 'climate' && (
                          <div className="thermostat-dial">
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Target</span>
                            <span className="temp-display">{d.state.targetTemp}°F</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.state.mode}</span>
                          </div>
                        )}
                        {d.category === 'security' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: d.state.locked ? 'var(--status-green)' : 'var(--status-amber)' }}>
                              {d.state.locked ? '🔒 Locked' : '🔓 Unlocked'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🔋 {d.state.battery}%</span>
                          </div>
                        )}
                        {d.category === 'media' && (
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {d.state.app} &middot; Vol {d.state.volume} &middot; {d.state.playing ? '▶ Playing' : '⏸ Paused'}
                          </div>
                        )}
                        {d.category === 'camera' && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {d.state.lastEvent}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Ring Camera Preview */}
                <div className="ring-camera-preview">
                  <div className="camera-feed-header">
                    <span className="camera-live-badge">
                      <span className="status-dot online" style={{ width: 6, height: 6 }} /> LIVE
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ring Doorbell Pro &middot; Front Porch</span>
                  </div>
                  <div className="camera-simulated-view">
                    <div className="camera-scanline" />
                    <span style={{ fontSize: '42px', opacity: 0.2 }}>📷</span>
                    <span style={{ fontSize: '13px', color: '#64748b', marginTop: 8 }}>Simulated Feed Active</span>
                  </div>
                  <div className="camera-event-overlay">
                    📦 Last: Package delivered at 11:20 AM
                  </div>
                </div>
              </div>
            </div>

            {/* Ambient Metrics */}
            {ambient && (
              <div>
                <div className="section-header">
                  <h3 className="section-title">🌡️ Ambient Sensors</h3>
                </div>
                <div className="ambient-bar">
                  <div className="ambient-metric-box">
                    <span className="ambient-metric-label">Indoor Temp</span>
                    <span className="ambient-metric-value">{ambient.indoorTemperature}°F</span>
                  </div>
                  <div className="ambient-metric-box">
                    <span className="ambient-metric-label">Humidity</span>
                    <span className="ambient-metric-value">{ambient.humidity}%</span>
                  </div>
                  <div className="ambient-metric-box">
                    <span className="ambient-metric-label">Air Quality</span>
                    <span className="ambient-metric-value" style={{ color: ambient.airQualityIndex <= 50 ? 'var(--status-green)' : 'var(--status-amber)' }}>
                      {ambient.airQualityIndex} AQI
                    </span>
                  </div>
                  <div className="ambient-metric-box">
                    <span className="ambient-metric-label">Noise Level</span>
                    <span className="ambient-metric-value">{ambient.noiseLevelDb} dB</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column – MCP Inspector Console */}
          <div>
            <div className="glass-panel mcp-console">
              <div className="mcp-console-header">
                <h3 className="section-title" style={{ fontSize: '16px' }}>
                  ⚡ MCP Streamable HTTP Inspector
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Spec 2025-11-25
                </span>
              </div>
              <div className="mcp-console-list">
                {mcpLogs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13px' }}>
                    Send a command to see MCP JSON-RPC traffic appear here in real time.
                  </div>
                )}
                {mcpLogs.map((log) => (
                  <div key={log.id} className="mcp-packet-row">
                    <div className="mcp-packet-top">
                      <span className="method-tag">{log.method}</span>
                      <span className="latency-tag">{log.latencyMs}ms</span>
                    </div>
                    {log.params && (
                      <div className="mcp-packet-payload">
                        → {JSON.stringify(log.params)}
                      </div>
                    )}
                    {log.result && (
                      <div className="mcp-packet-payload" style={{ color: '#86efac' }}>
                        ← {log.result}
                      </div>
                    )}
                    {log.error && (
                      <div className="mcp-packet-payload" style={{ color: '#fca5a5' }}>
                        ✕ {log.error}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
