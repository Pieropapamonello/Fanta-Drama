#!/usr/bin/env bash
# Usage: export RENDER_API_KEY=rrr_xxx
#        export RENDER_SERVICE_ID=service-xxx
#        export TELEGRAM_BOT_TOKEN=...
#        then run: ./scripts/set_render_env.sh
# This script calls Render REST API to set an environment variable on the service.

set -e

if [ -z "$RENDER_API_KEY" ] || [ -z "$RENDER_SERVICE_ID" ]; then
  echo "Set RENDER_API_KEY and RENDER_SERVICE_ID environment variables"
  exit 1
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "TELEGRAM_BOT_TOKEN not found in env; nothing to set. Use TELEGRAM_BOT_TOKEN=... ./scripts/set_render_env.sh"
  exit 1
fi

API="https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars"

# Render API: POST to create env var
curl -s -X POST "$API" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"TELEGRAM_BOT_TOKEN\", \"value\": \"$TELEGRAM_BOT_TOKEN\", \"scope\": \"env\"}" \
  | jq .

echo "Done. Render may take a moment to apply the change and redeploy the service."