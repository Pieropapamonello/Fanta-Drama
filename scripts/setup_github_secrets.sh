#!/usr/bin/env bash
# Usage: export GITHUB_REPO=owner/repo
#        export TELEGRAM_BOT_TOKEN=...
#        export RENDER_SERVICE_ID=...
#        export RENDER_API_KEY=...
#        then run: ./scripts/setup_github_secrets.sh
# This script uses GitHub CLI (`gh`) to set repository secrets for Actions.

set -e

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI (gh) first: https://cli.github.com/"
  exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
  echo "Set GITHUB_REPO env var (owner/repo)"
  exit 1
fi

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Setting TELEGRAM_BOT_TOKEN..."
  echo -n "$TELEGRAM_BOT_TOKEN" | gh secret set TELEGRAM_BOT_TOKEN -R "$GITHUB_REPO" --body -
else
  echo "TELEGRAM_BOT_TOKEN not set; skipping"
fi

if [ -n "$RENDER_SERVICE_ID" ]; then
  echo "Setting RENDER_SERVICE_ID..."
  echo -n "$RENDER_SERVICE_ID" | gh secret set RENDER_SERVICE_ID -R "$GITHUB_REPO" --body -
else
  echo "RENDER_SERVICE_ID not set; skipping"
fi

if [ -n "$RENDER_API_KEY" ]; then
  echo "Setting RENDER_API_KEY..."
  echo -n "$RENDER_API_KEY" | gh secret set RENDER_API_KEY -R "$GITHUB_REPO" --body -
else
  echo "RENDER_API_KEY not set; skipping"
fi

echo "Done. Verify secrets in GitHub repository settings."