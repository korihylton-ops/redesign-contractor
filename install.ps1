# Install redesign-contractor as a Claude Code skill on Windows (works for any assistant that reads SKILL.md).
param([string]$Dest = "$env:USERPROFILE\.claude\skills\redesign-contractor")
$Repo = if ($env:REDESIGN_CONTRACTOR_REPO) { $env:REDESIGN_CONTRACTOR_REPO } else { "https://github.com/korihylton-ops/redesign-contractor" }
$ErrorActionPreference = "Stop"
if (Test-Path "$Dest\.git") { git -C $Dest pull --ff-only } else { New-Item -ItemType Directory -Force (Split-Path $Dest) | Out-Null; git clone $Repo $Dest }
Push-Location "$Dest\scripts"; npm install; npx playwright install chromium; Pop-Location
Write-Host "Installed to $Dest. Restart your assistant, then run: /redesign-contractor https://client-site.com"
Write-Host "Set DEEPSEEK_API_KEY in your environment (or the project's .env) for the AI chatbot. Never commit it."
