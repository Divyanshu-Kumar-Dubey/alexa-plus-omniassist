# Amazon Developer Hackathon 2026: Friction Log & Developer Experience Report

> **Hackathon Track:** Alexa+  
> **Mini-Challenges:** AWS Builder & Open Source  
> **Topic:** Friction Log for Model Context Protocol (MCP) Streamable HTTP, Agent Skills, and Amazon Bedrock Integration  
> **Judging Bonus Category:** Up to 10% judging bonus for actionable feedback & friction logs.

---

## Executive Summary

During the development of **OmniAssist Alexa+**, we built a self-hosted Model Context Protocol (MCP) server running on the **Streamable HTTP transport** specification (version `2025-11-25`), integrated it with **Amazon Bedrock (Claude 3.5 Sonnet / AWS Nova)**, and developed an interactive **Alexa+ Multimodal Simulation Canvas**. 

Below is our structured friction log documenting real obstacles encountered, their impact, workarounds devised, and concrete suggestions for the Amazon Developer and MCP working group teams.

---

## Friction Entry #1: MCP Streamable HTTP Spec Ambiguity with Session Resumption & SSE Keep-Alives

- **Component:** Model Context Protocol (MCP) SDK / Streamable HTTP Transport Specification (`2025-11-25`)
- **Severity:** High (impacting client connection stability and streaming chunk delivery)
- **Task Attempted:**  
  Implementing full bi-directional streaming over HTTP/1.1 and HTTP/2 for low-latency Alexa voice responses while maintaining persistent tool subscription states.
- **Expected Behavior:**  
  The Streamable HTTP specification should provide a standardized, plug-and-play header handshake (e.g. `X-MCP-Session-Id` and chunked transfer encoding conventions) for handling client disconnects, reconnects, and mid-stream tool execution heartbeats without requiring custom fallback polling.
- **Actual Behavior:**  
  When an SSE stream terminates due to client-side network fluctuations, the session state on the self-hosted MCP server is abruptly lost unless a custom in-memory token registry is hand-rolled. Standard MCP client libraries often threw unhandled socket hang-up errors when consuming chunked JSON-RPC streams over plain HTTP.
- **Workaround Implemented:**  
  We implemented a custom Dual-Transport Gateway in the server (`server/src/transports/streamableHttp.ts`) that manages idempotent session IDs (`Mcp-Session-Id`), buffers undelivered notifications in a ring buffer, and allows reconnection via an explicit `GET /sse?sessionId=...` with chunked replay.
- **Actionable Recommendation for Amazon Developer / MCP Spec:**  
  Provide an official, drop-in `@modelcontextprotocol/sdk-streamable-http` adapter package for Express/Fastify with built-in heartbeat/reconnection logic and automated CORS/SSE header negotiation.

---

## Friction Entry #2: Bedrock Converse Stream Tool Calling Schema Translation Overhead

- **Component:** Amazon Bedrock Runtime SDK (`@aws-sdk/client-bedrock-runtime`) & MCP Tool Definitions
- **Severity:** Medium
- **Task Attempted:**  
  Exposing MCP tool schemas (JSON Schema Draft-07) directly to Amazon Bedrock's Converse API (`toolConfig.tools.toolSpec`) without manually rewriting parameters.
- **Expected Behavior:**  
  Seamless 1-to-1 parity between MCP standard `inputSchema` format and Bedrock `toolSpec.input.json` schema definitions.
- **Actual Behavior:**  
  Amazon Bedrock's Converse API requires strict formatting for `toolSpec` where nested `$schema` properties or certain JSON Schema combinations (like `anyOf` with complex objects) occasionally trigger `ValidationException: The input jsonSchema for tool is invalid`.
- **Workaround Implemented:**  
  Created an automated schema sanitizer (`agent/src/schemaSanitizer.ts`) that strips unsupported meta-tags (`$schema`, `title`) from MCP tool definitions and converts them into Bedrock-compliant JSON specs prior to sending the converse request.
- **Actionable Recommendation for Amazon Developer / AWS Team:**  
  Release an official AWS Bedrock MCP Bridge utility that maps standard MCP tools directly into Bedrock `ToolConfiguration` objects, minimizing boilerplate for agentic developers.

---

## Friction Entry #3: Multimodal Voice & Visual Latency Budget on Alexa+ Simulation

- **Component:** Alexa+ Audio-Visual Synchronization in Web Environments
- **Severity:** Medium
- **Task Attempted:**  
  Synchronizing real-time text-to-speech (TTS) audio playback with dynamic visual widgets (Echo Show styled cards, lights toggling, thermostat dials) during streaming LLM inference.
- **Expected Behavior:**  
  Visual actions should trigger optimistically upon tool decision emission, while TTS starts speaking the explanatory response smoothly.
- **Actual Behavior:**  
  Waiting for full LLM completion before speaking creates an audible 1.8s delay, detracting from the "instant ambient response" feeling of an Alexa+ device.
- **Workaround Implemented:**  
  Developed an Optimistic Tool Executor in the web client (`web/src/hooks/useAlexaAgent.ts`). The moment a tool call chunk is parsed in the stream, the UI immediately updates device state widgets and begins phoneme generation on the initial sentence while subsequent tokens continue streaming.
- **Actionable Recommendation for Amazon Developer:**  
  Expose official Alexa+ simulator SDK components (like React and Web Components for standard Echo Show / Fire TV widgets) that incorporate built-in optimistic rendering and voice synthesis synchronization hooks.

---

## Feature Requests (Prioritized)

1. **[CRITICAL] Official Amazon Alexa+ MCP Starter Template**  
   A pre-configured repository with Docker, Streamable HTTP server, and simulated Echo Show canvas to accelerate hackathon onboarding from hours to minutes.
2. **[IMPORTANT] Webhook & Push Support for Alexa+ Agent Skills**  
   Allow MCP servers to push proactive alerts (e.g., smart doorbell ring, leak sensor tripped) directly into the Alexa+ agent loop without continuous client polling.
3. **[NICE-TO-HAVE] Native VS Code / Antigravity IDE Extension for MCP Inspection**  
   An in-editor debugger to test MCP Streamable HTTP endpoints and visualize JSON-RPC request/response payloads in real time.
