#!/usr/bin/env bash
# Install redesign-contractor as a Claude Code skill (works for any assistant that reads SKILL.md).
set -euo pipefail
DEST="${1:-$HOME/.claude/skills/redesign-contractor}"
REPO="${REDESIGN_CONTRACTOR_REPO:-https://github.com/korihylton-ops/redesign-contractor}"
if [ -d "$DEST/.git" ]; then git -C "$DEST" pull --ff-only; else mkdir -p "$(dirname "$DEST")" && git clone "$REPO" "$DEST"; fi
( cd "$DEST/scripts" && npm install && npx playwright install chromium )
echo "Installed to $DEST. Restart your assistant, then run: /redesign-contractor https://client-site.com"
echo "Set DEEPSEEK_API_KEY in your environment (or the project's .env) for the AI chatbot. Never commit it."
