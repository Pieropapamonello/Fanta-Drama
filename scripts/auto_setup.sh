#!/usr/bin/env bash
# Auto setup script
# Usage (run locally):
# export GITHUB_PAT=ghp_...
# export GITHUB_USER=your-github-username-or-org
# export REPO_NAME=repo-name
# export RENDER_API_KEY=rnd_...
# export RENDER_SERVICE_ID=service-...
# export TELEGRAM_BOT_TOKEN=8712...
# cd to project root and run: ./scripts/auto_setup.sh

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

if [ -z "${GITHUB_PAT:-}" ] || [ -z "${GITHUB_USER:-}" ] || [ -z "${REPO_NAME:-}" ]; then
  echo "Please export GITHUB_PAT, GITHUB_USER and REPO_NAME before running."
  exit 1
fi

if [ -z "${RENDER_API_KEY:-}" ] || [ -z "${RENDER_SERVICE_ID:-}" ] || [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "Please export RENDER_API_KEY, RENDER_SERVICE_ID and TELEGRAM_BOT_TOKEN before running."
  exit 1
fi

# Authenticate gh with the provided PAT
echo "$GITHUB_PAT" | gh auth login --with-token

FULL_REPO="$GITHUB_USER/$REPO_NAME"

# Create repo on GitHub and push current folder
if gh repo view "$FULL_REPO" >/dev/null 2>&1; then
  echo "Repository $FULL_REPO already exists. Skipping creation."
else
  echo "Creating repository $FULL_REPO..."
  gh repo create "$FULL_REPO" --public --source=. --remote=origin --push -y
fi

# Set GitHub Actions secrets
echo "Setting GitHub repo secrets..."
gh secret set RENDER_SERVICE_ID -R "$FULL_REPO" --body "$RENDER_SERVICE_ID"
gh secret set RENDER_API_KEY -R "$FULL_REPO" --body "$RENDER_API_KEY"
gh secret set TELEGRAM_BOT_TOKEN -R "$FULL_REPO" --body "$TELEGRAM_BOT_TOKEN"

# Configure Render env var via API
echo "Setting Render env var TELEGRAM_BOT_TOKEN via API..."
API_URL="https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars"
curl -s -X POST "$API_URL" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"TELEGRAM_BOT_TOKEN\", \"value\": \"$TELEGRAM_BOT_TOKEN\", \"scope\": \"env\"}" \
  | jq . || true

echo "All done. Pushed repo and configured secrets/env."

echo "If you need to revoke the GH PAT or the Render API key, do so from their dashboards."
