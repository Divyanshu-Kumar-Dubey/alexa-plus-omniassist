# Amazon Developer Hackathon 2026: Official Product Feedback

> **Submission Track:** Alexa+  
> **Submitted by:** Ansh Dubey & Team  
> **Project:** OmniAssist Alexa+ (Next-Gen Autonomous Concierge)

---

## 1. Tools, APIs, and SDKs Used in This Project

1. **Model Context Protocol (MCP) Specification (Streamable HTTP / Spec 2025-11-25+)**
   - **What we used it for:** Implementing a self-hosted, bidirectional tool and context server providing smart home execution, ambient IoT queries, personal calendar scheduling, and device telemetry to Alexa+.
   - **What worked well:** The protocol's standardized abstraction for Tools, Resources, and Prompts creates unprecedented modularity. It decoupled our agent reasoning engine from the underlying smart device hardware implementations.
   - **What needs work:** Streamable HTTP transport documentation lacks standardized reference implementations for reconnecting interrupted streaming sessions over SSE.
   - **How onboarding felt:** Straightforward for standard STDIO transports; slightly more involved for Streamable HTTP due to evolving specification nuances.
   - **Would we build with it again?** Yes, absolutely. MCP is becoming the gold standard for agentic tool integration.

2. **Amazon Bedrock (Claude 3.5 Sonnet / AWS Nova) via AWS SDK**
   - **What we used it for:** Autonomous intent reasoning, multi-step planning, conversational response generation, and automated tool invocation.
   - **What worked well:** Extremely fast token latency using the Converse Stream API; stellar zero-shot reasoning for complex multi-device instructions (e.g. "Dim the living room to 40%, set temperature to 71 degrees, and lock the front door").
   - **What needs work:** Strict input JSON schema validation where minor Draft-07 metadata properties can cause unexpected schema rejections.
   - **How onboarding felt:** Excellent. IAM credential setup, AWS console model access request, and SDK documentation were smooth.
   - **Would we build with it again?** Definitely. Bedrock is our first choice for production-grade agent intelligence.

3. **Amazon Devices Builder Tools & Agent Skills Patterns**
   - **What we used it for:** Designing agent skill capabilities that replicate native Alexa+ skills and ambient device integration.
   - **What worked well:** Provided clear architectural direction on how modern conversational agents should interact with peripheral hardware.
   - **What needs work:** More open-source sample code showcasing Streamable HTTP over remote networks would help independent builders.
   - **Would we build with it again?** Yes.

---

## 2. AWS Builder Mini-Challenge Answers

- **Which AWS Services Were Integrated:**
  - **Amazon Bedrock**: LLM backbone utilizing `anthropic.claude-3-5-sonnet-20241022-v2:0` and `amazon.nova-pro-v1:0` via the Converse API.
  - **AWS SDK v3 (`@aws-sdk/client-bedrock-runtime`)**: Streaming API integration handling real-time tool execution deltas.
- **Integration Architecture:**
  - The Alexa+ orchestrator intercepts natural voice input, converts it into a Bedrock converse stream, dynamically queries our MCP server for tool definitions, streams tool decisions back into the MCP server via Streamable HTTP, and renders audio-visual responses in real time.

---

## 3. Open Source Mini-Challenge Answers

- **Repository:** `alexa-plus-omniassist` (Public GitHub repository with full source code, open-source MIT License).
- **License:** MIT License (clearly declared in the root `LICENSE` file and repository about section).
- **Why it matters:** Provides developers worldwide with a fully working, plug-and-play template for building Streamable HTTP MCP servers and simulated Alexa+ multimodal experiences without vendor lock-in.
