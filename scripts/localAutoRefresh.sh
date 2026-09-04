#!/usr/bin/env bash
# Stopgap auto-refresh that runs on Krish's laptop (cron, every 3 hours) until the GitHub
# Actions workflow can be pushed. Refreshes the live weather cache, commits and pushes —
# Vercel then redeploys. Skips silently if a refresh is already running, if the repo has
# unrelated uncommitted changes to these files, or if the machine is offline.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="$HOME/.heatops-autorefresh.log"
exec >>"$LOG" 2>&1
echo "=== $(date -Is) start"
if pgrep -f "node scripts/refreshWeatherCache.mjs" >/dev/null; then echo "another refresh is running — skip"; exit 0; fi
if ! curl -s -m 10 -o /dev/null https://api.open-meteo.com/v1/forecast?latitude=28.6\&longitude=77.2\&current=temperature_2m; then echo "offline — skip"; exit 0; fi
git fetch -q origin main
git stash list >/dev/null
timeout 2400 node scripts/refreshWeatherCache.mjs || { echo "refresh failed/timed out"; exit 0; }
git add public/live-weather-cache.json public/data/history/
if git diff --cached --quiet; then echo "no change"; exit 0; fi
STAMP=$(node -e "console.log(require('./public/live-weather-cache.json').lastUpdated)")
CARRIED=$(node -e "console.log(require('./public/live-weather-cache.json').carriedForwardCount || 0)")
git -c user.name=kkrrishagarwal -c user.email=kkrrish.agarwal@gmail.com commit -q -m "Automated weather cache refresh (laptop cron) — ${STAMP}" -m "carried forward: ${CARRIED}"
for i in 1 2 3; do
  if git push -q origin HEAD:main; then echo "pushed ${STAMP} (carried ${CARRIED})"; exit 0; fi
  git fetch -q origin main && git rebase -q origin/main || { git rebase --abort; echo "rebase failed"; exit 0; }
done
echo "push failed after retries"
