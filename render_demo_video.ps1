$ffmpeg = "C:\Program Files\File Converter\ffmpeg.exe"
$assets = "C:\Users\Ansh Dubey\.gemini\antigravity-ide\scratch\alexa-plus-omniassist\assets"

Write-Host "Rendering Scene 1 (Intro, 24s)..."
& $ffmpeg -y -loop 1 -t 24 -i "$assets\slide_1_intro.png" `
  -vf "scale=1920:1080,format=yuv420p" -r 30 -c:v libx264 -preset fast "$assets\scene1.mp4"

Write-Host "Rendering Scene 2 (Hero Dashboard, 32s)..."
& $ffmpeg -y -loop 1 -t 32 -i "$assets\hero_dashboard.png" `
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#070A13,format=yuv420p" -r 30 -c:v libx264 -preset fast "$assets\scene2.mp4"

Write-Host "Rendering Scene 3 (Architecture, 30s)..."
& $ffmpeg -y -loop 1 -t 30 -i "$assets\slide_2_architecture.png" `
  -vf "scale=1920:1080,format=yuv420p" -r 30 -c:v libx264 -preset fast "$assets\scene3.mp4"

Write-Host "Rendering Scene 4 (MCP Diagnostics Scroll, 30s)..."
& $ffmpeg -y -loop 1 -t 30 -i "$assets\mcp_diagnostics.png" `
  -vf "scale=1920:-1,crop=1920:1080:0:'min(in_h-1080, (t/26)*(in_h-1080))',format=yuv420p" -r 30 -c:v libx264 -preset fast "$assets\scene4.mp4"

Write-Host "Rendering Scene 5 (Outro, 12s)..."
& $ffmpeg -y -loop 1 -t 12 -i "$assets\slide_3_outro.png" `
  -vf "scale=1920:1080,format=yuv420p" -r 30 -c:v libx264 -preset fast "$assets\scene5.mp4"

Write-Host "Concatenating scenes..."
$concatList = @"
file '$assets\scene1.mp4'
file '$assets\scene2.mp4'
file '$assets\scene3.mp4'
file '$assets\scene4.mp4'
file '$assets\scene5.mp4'
"@
Set-Content -Path "$assets\concat.txt" -Value $concatList

& $ffmpeg -y -f concat -safe 0 -i "$assets\concat.txt" -c copy "$assets\combined_video.mp4"

Write-Host "Merging video with narration audio..."
& $ffmpeg -y -i "$assets\combined_video.mp4" -i "$assets\narration.wav" `
  -c:v copy -c:a aac -b:a 192k -shortest "$assets\omniassist_alexa_demo.mp4"

# Cleanup intermediate scene files
Remove-Item "$assets\scene*.mp4" -ErrorAction SilentlyContinue
Remove-Item "$assets\concat.txt" -ErrorAction SilentlyContinue
Remove-Item "$assets\combined_video.mp4" -ErrorAction SilentlyContinue

Write-Host "DEMO VIDEO GENERATION COMPLETE: $assets\omniassist_alexa_demo.mp4"
