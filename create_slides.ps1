Add-Type -AssemblyName System.Drawing

function Create-Slide {
    param(
        [string]$Path,
        [string]$BadgeText,
        [string]$TitleText,
        [string]$SubtitleText,
        [string[]]$Bullets,
        [string]$FooterText
    )

    $width = 1920
    $height = 1080
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Background Gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(7, 10, 19),
        [System.Drawing.Color]::FromArgb(15, 23, 42),
        45.0
    )
    $gfx.FillRectangle($bgBrush, $rect)

    # Ambient Glow Circles
    $glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 0, 202, 255))
    $gfx.FillEllipse($glowBrush1, -200, -200, 800, 800)
    $glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 168, 85, 247))
    $gfx.FillEllipse($glowBrush2, 1300, 500, 900, 900)

    # Outer Glassmorphism Card Frame
    $cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 2)
    $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
    $cardRect = New-Object System.Drawing.Rectangle(120, 80, 1680, 920)
    $gfx.FillRectangle($cardBrush, $cardRect)
    $gfx.DrawRectangle($cardPen, $cardRect)

    # Badge
    if ($BadgeText) {
        $badgeFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
        $badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 0, 168, 225))
        $badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $badgeSize = $gfx.MeasureString($BadgeText, $badgeFont)
        $badgeW = [int]$badgeSize.Width + 30
        $badgeH = [int]$badgeSize.Height + 14
        $badgeRect = New-Object System.Drawing.Rectangle(180, 140, $badgeW, $badgeH)
        $gfx.FillRectangle($badgeBg, $badgeRect)
        $gfx.DrawString($BadgeText, $badgeFont, $badgeTextBrush, 195, 147)
    }

    # Title
    $titleFont = New-Object System.Drawing.Font("Segoe UI", 52, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 229, 255))
    $gfx.DrawString($TitleText, $titleFont, $titleBrush, 180, 220)

    # Subtitle
    $subFont = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(203, 213, 225))
    $gfx.DrawString($SubtitleText, $subFont, $subBrush, 180, 320)

    # Horizontal divider line
    $divPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 2)
    $gfx.DrawLine($divPen, 180, 390, 1740, 390)

    # Bullets / Key Features
    $bulletFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
    $bulletBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 202, 255))
    
    $y = 440
    foreach ($bullet in $Bullets) {
        $gfx.FillEllipse($dotBrush, 190, $y + 10, 14, 14)
        $gfx.DrawString($bullet, $bulletFont, $bulletBrush, 220, $y)
        $y += 90
    }

    # Footer
    if ($FooterText) {
        $footerFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Italic)
        $footerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
        $gfx.DrawString($FooterText, $footerFont, $footerBrush, 180, 920)
    }

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $gfx.Dispose()
    $bmp.Dispose()
    Write-Host "Created slide: $Path"
}

# Slide 1: Intro Title Card
Create-Slide -Path "assets\slide_1_intro.png" `
    -BadgeText "AMAZON DEVELOPER HACKATHON 2026" `
    -TitleText "OmniAssist Alexa+" `
    -SubtitleText "Next-Gen Autonomous Concierge powered by Model Context Protocol (MCP) & Amazon Bedrock" `
    -Bullets @(
        "Primary Track: Alexa+ (Self-Hosted Streamable HTTP MCP Server)",
        "Mini-Challenges: AWS Builder (Amazon Bedrock Converse) & Open Source (MIT)",
        "Ambient Multimodal Experience: Echo Show & Fire TV Glassmorphism 2.0 Canvas",
        "Bonus Category: Comprehensive 3-Part Developer Friction Log Included"
    ) `
    -FooterText "Developed by Divyanshu Kumar Dubey | Public GitHub: github.com/Divyanshu-Kumar-Dubey/alexa-plus-omniassist"

# Slide 2: Architecture & Bedrock Core
Create-Slide -Path "assets\slide_2_architecture.png" `
    -BadgeText "SYSTEM ARCHITECTURE & PROTOCOL" `
    -TitleText "Streamable HTTP MCP + Bedrock Core" `
    -SubtitleText "Standardized decoupling of conversational reasoning from smart device execution" `
    -Bullets @(
        "Self-Hosted MCP Server: Spec 2025-11-25+ over chunked HTTP (POST /mcp) and SSE (GET /sse)",
        "Amazon Bedrock Integration: Claude 3.5 Sonnet & AWS Nova Converse Stream tool execution",
        "6 Ambient Smart Tools: RGB Lighting, Climate HVAC, Smart Deadbolts, Ring Cameras, & Sensors",
        "Dual-Engine Intelligence: Live AWS Bedrock cloud mode + deterministic offline simulation mode"
    ) `
    -FooterText "Decoupled architecture eliminates rigid intent slots in favor of autonomous agentic multi-tool plans."

# Slide 3: Outro & GitHub Submission
Create-Slide -Path "assets\slide_3_outro.png" `
    -BadgeText "DEVPOST SUBMISSION READY" `
    -TitleText "Build, Ship, Shape: Ready for Production" `
    -SubtitleText "Fully tested, containerized, and open-sourced for the global Alexa+ developer community" `
    -Bullets @(
        "One-Command Launch: docker compose up --build (orchestrates MCP server & web simulator)",
        "Automated CI/CD: GitHub Actions pipeline verifying TypeScript compilation and MCP unit tests",
        "Friction Log Bonus: Deep-dive DX report on Streamable HTTP, SSE keep-alives, & Bedrock schemas",
        "Complete Source & Assets: github.com/Divyanshu-Kumar-Dubey/alexa-plus-omniassist"
    ) `
    -FooterText "Thank you to the Amazon Developer team! MIT Licensed & Open Source."
