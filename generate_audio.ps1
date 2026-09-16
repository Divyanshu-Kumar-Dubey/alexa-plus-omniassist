Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Zira Desktop")
$synth.Rate = 0
$outputDir = "C:\Users\Ansh Dubey\.gemini\antigravity-ide\scratch\alexa-plus-omniassist\assets"
$synth.SetOutputToWaveFile("$outputDir\narration.wav")

$text = "Welcome to OmniAssist Alexa Plus, built for the Amazon Developer Hackathon 2026. Legacy voice assistants rely on rigid, hardcoded intent slots that break when requests get complex. OmniAssist pioneers the next era of ambient computing by combining the open Model Context Protocol with Amazon Bedrock multi-step reasoning. " +
"Here is the Alexa Plus multimodal canvas, styled with luxury glassmorphism for Echo Show and Fire TV. Notice the dynamic cyan halo and real-time audio visualizer responding to voice input. Watch what happens when we issue a multi-device voice command: Alexa, good morning. Turn on the kitchen lights to eighty percent warm white and set the thermostat to seventy-two degrees. The agent immediately executes both actions with optimistic card updates and synchronized voice feedback. " +
"Next, we trigger Movie Night mode. With a single command, the living room lights dim to deep violet, and the smart deadbolt automatically locks for security. We can also query our Ring doorbell camera to inspect live porch activity, or check indoor air quality and temperature sensors in real time. " +
"Under the hood, all device orchestration is powered by our self-hosted Model Context Protocol server, adhering to the latest specification over Streamable HTTP and Server-Sent Events. The live MCP Inspector displays raw JSON-RPC 2.0 requests, tool parameters, and ultra-low latency execution in real time. " +
"Intelligence is powered by Amazon Bedrock using the Claude 3.5 Sonnet and AWS Nova Converse Stream API, with an automated schema sanitizer bridging standard MCP tools into Bedrock tool specs. The project is completely open source under the MIT License, containerized with Docker, verified with GitHub Actions CI, and backed by a comprehensive developer friction log. Thank you, and we invite you to explore OmniAssist Alexa Plus on GitHub."

$synth.Speak($text)
$synth.Dispose()
Write-Host "Narration WAV successfully generated!"
