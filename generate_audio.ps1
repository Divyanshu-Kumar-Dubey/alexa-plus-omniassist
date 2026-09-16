Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Select Male Voice
$maleVoice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male } | Select-Object -First 1
if ($maleVoice) {
    $synth.SelectVoice($maleVoice.VoiceInfo.Name)
    Write-Host "Selected Male Voice: $($maleVoice.VoiceInfo.Name)"
} else {
    $synth.SelectVoice("Microsoft David Desktop")
    Write-Host "Selected Male Voice: Microsoft David Desktop"
}

# Measured human pacing: -1 gives natural pauses and cadence
$synth.Rate = -1

$outputDir = "C:\Users\Ansh Dubey\.gemini\antigravity-ide\scratch\alexa-plus-omniassist\assets"
$rawWav = "$outputDir\narration_raw.wav"
$masteredWav = "$outputDir\narration.wav"

$synth.SetOutputToWaveFile($rawWav)

# Human-cadence narration text with natural conversational pauses
$text = @"
Welcome to OmniAssist Alexa Plus, built for the Amazon Developer Hackathon 2026.

Legacy voice assistants are limited by rigid, hardcoded intent slots that break when requests get complex. OmniAssist pioneers the next era of ambient computing, combining the open Model Context Protocol with Amazon Bedrock multi-step reasoning.

Here is the Alexa Plus multimodal canvas, styled with luxury glassmorphism for Echo Show and Fire TV. Notice the dynamic cyan halo and real-time audio visualizer responding to voice input.

Watch what happens when we issue a multi-device voice command: Alexa, good morning. Turn on the kitchen lights to eighty percent warm white, and set the thermostat to seventy-two degrees.

The agent immediately executes both actions, with optimistic card updates and synchronized voice feedback.

Next, we trigger Movie Night mode. With a single command, the living room lights dim to deep violet, and the smart deadbolt automatically locks for security. We can also query our Ring doorbell camera to inspect live porch activity, or check indoor air quality and temperature sensors in real time.

Under the hood, all device orchestration is powered by our self-hosted Model Context Protocol server, adhering to the latest specification over Streamable HTTP and Server-Sent Events. The live MCP Inspector displays raw JSON-RPC 2.0 requests, tool parameters, and ultra-low latency execution in real time.

Intelligence is powered by Amazon Bedrock using the Claude 3.5 Sonnet and AWS Nova Converse Stream API, with an automated schema sanitizer bridging standard MCP tools into Bedrock tool specs.

The project is completely open source under the MIT License, containerized with Docker, verified with GitHub Actions CI, and backed by a comprehensive developer friction log.

Thank you, and we invite you to explore OmniAssist Alexa Plus on GitHub.
"@

$synth.Speak($text)
$synth.Dispose()
Write-Host "Raw male narration generated: $rawWav"

# Apply Broadcast Studio Vocal Mastering via FFmpeg:
# - Highpass at 75 Hz (removes synthetic low rumble)
# - Warm chest boost at 125 Hz (+3.5 dB for deep, rich masculine resonance)
# - Cut harsh digital boxiness at 1000 Hz (-1.5 dB)
# - Boost vocal presence and clarity at 3500 Hz (+2.5 dB)
# - Dynamic compression and normalization for broadcast punch
$ffmpeg = "C:\Program Files\File Converter\ffmpeg.exe"
$audioFilters = "highpass=f=75,equalizer=f=125:width_type=o:w=1:g=3.5,equalizer=f=1000:width_type=o:w=1.2:g=-1.5,equalizer=f=3500:width_type=o:w=1:g=2.5,compand=attacks=0.01:decays=0.15:points=-80/-80|-40/-30|-20/-10|0/-2:gain=3.5,volume=1.3"

& $ffmpeg -y -i $rawWav -af $audioFilters -ar 48000 $masteredWav
Remove-Item $rawWav -ErrorAction SilentlyContinue

Write-Host "Mastered Male Voiceover complete: $masteredWav"
