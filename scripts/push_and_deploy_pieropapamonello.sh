#!/usr/bin/env bash
# Push current folder to https://github.com/Pieropapamonello/Fanta-Drama
# Then set secrets (if provided) and trigger Render deploy.
# Run locally after exporting your tokens as env vars.

set -euo pipefail

GITHUB_REMOTE_URL="https://github.com/Pieropapamonello/Fanta-Drama.git"

echo "This script will push the current folder to $GITHUB_REMOTE_URL and trigger deploy on Render."

echo "Make sure you exported these environment variables in your shell before running:"
echo "  GITHUB_PAT (optional, to set GitHub secrets via gh)"
echo "  RENDER_API_KEY (optional — only if you want to trigger deploy via API)"
echo "  RENDER_SERVICE_ID (optional — only if you want to trigger deploy via API)"
echo "  TELEGRAM_BOT_TOKEN (optional to set as secret/env)"

echo
read -p "Continue? [y/N] " confirm
if [ "${confirm,,}" != "y" ]; then
  echo "Aborted by user"
  exit 1
fi
set -euo pipefail

GITHUB_REMOTE_URL="https://github.com/Pieropapamonello/Fanta-Drama.git"
LOGFILE="$(pwd)/scripts/push_and_deploy_pieropapamonello.log"

echo "=== Push+Deploy script started at $(date -u) ===" | tee -a "$LOGFILE"

# Initialize git if needed
if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "Initial commit - Fanta Drama"
else
  git add .
  git commit -m "Update by local user" || true
fi

# Add remote if missing
if git remote get-url origin >/dev/null 2>&1; then
  echo "Origin remote already exists. Replacing with target repo."
  git remote remove origin || true

fi

git remote add origin "$GITHUB_REMOTE_URL"

echo "Pushing to origin main..."
git branch -M main || true

git push -u origin main


# Create a backup tag before pushing
PREV_TAG="pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)"
git tag -f "$PREV_TAG" || true
git push origin --tags --no-verify 2>/dev/null || true
echo "Created backup tag $PREV_TAG" | tee -a "$LOGFILE"

echo "Pushed to GitHub."

# If GITHUB_PAT present, set repo secrets using gh
if [ -n "${GITHUB_PAT:-}" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not installed; skipping setting GitHub secrets. Install it to enable secret setup." | tee -a "$LOGFILE"
  else
    echo "Authenticating gh..." | tee -a "$LOGFILE"
    echo "$GITHUB_PAT" | gh auth login --with-token
    echo "Setting GitHub Actions secrets..." | tee -a "$LOGFILE"
    if [ -n "${RENDER_SERVICE_ID:-}" ]; then
      echo -n "$RENDER_SERVICE_ID" | gh secret set RENDER_SERVICE_ID -R Pieropapamonello/Fanta-Drama --body -
    fi
    if [ -n "${RENDER_API_KEY:-}" ]; then
      echo -n "$RENDER_API_KEY" | gh secret set RENDER_API_KEY -R Pieropapamonello/Fanta-Drama --body -
    fi
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
      echo -n "$TELEGRAM_BOT_TOKEN" | gh secret set TELEGRAM_BOT_TOKEN -R Pieropapamonello/Fanta-Drama --body -
    fi
  fi
else
  echo "GITHUB_PAT not provided; skipping GitHub secret setup." | tee -a "$LOGFILE"
fi

# We rely on Render's auto-deploy on push. The script no longer calls Render API.
echo "Render API deploy skipped; ensure the repository is connected to Render and Auto Deploy on push is enabled." | tee -a "$LOGFILE"

echo "Done. Check the GitHub repository and Render dashboard for status."