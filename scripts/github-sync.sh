#!/bin/bash

set -e

echo "[GitHub Sync] Starting synchronization..."

if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_REPO" ]; then
  echo "[GitHub Sync] ERROR: GITHUB_TOKEN or GITHUB_REPO not set"
  exit 1
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"

if git remote get-url github 2>/dev/null; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

git config user.email "deploy@securelex.ru"
git config user.name "SecureLex Deploy Bot"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "[GitHub Sync] Fetching from GitHub..."
git fetch github "$BRANCH" 2>/dev/null || echo "[GitHub Sync] No remote branch yet, will create"

echo "[GitHub Sync] Adding all changes..."
git add -A

if git diff --cached --quiet; then
  echo "[GitHub Sync] No changes to commit"
else
  echo "[GitHub Sync] Committing changes..."
  git commit -m "Deploy: $TIMESTAMP" --allow-empty 2>/dev/null || true
fi

echo "[GitHub Sync] Pushing to GitHub..."
git push github "$BRANCH" --force

echo "[GitHub Sync] Successfully synchronized to GitHub!"
echo "[GitHub Sync] Repository: https://github.com/${GITHUB_REPO}"
