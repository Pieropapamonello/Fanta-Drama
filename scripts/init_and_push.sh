#!/bin/bash
# Helper script: inizializza repo locale e mostra come aggiungere remote
# USO: modificare GIT_REMOTE_URL con l'URL del tuo repository GitHub

set -e
if [ -z "$1" ]; then
  echo "Usage: $0 <git-remote-url>"
  exit 1
fi
GIT_REMOTE_URL=$1

git init
git add .
git commit -m "Initial Fanta Drama web+bot"

echo "Repository created locally. To push to GitHub run the following commands (paste your remote URL):"

echo "git remote add origin $GIT_REMOTE_URL"
echo "git branch -M main"
echo "git push -u origin main"
