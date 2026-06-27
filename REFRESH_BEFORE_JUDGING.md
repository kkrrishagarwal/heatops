# Manual data refresh + deploy — run this right before judging

The live Vercel site only updates `live-weather-cache.json` when you push a
new commit (it's a static file, not a live database). Run this once, a few
hours before your demo slot, so judging shows fresh "updated Xm ago" data
instead of stale numbers.

```bash
cd ~/Desktop/heatops

# 1. Pull fresh weather/AQI data for all ~1,690 cities (~8 minutes, no API key needed)
node scripts/refreshWeatherCache.mjs

# 2. Confirm it actually wrote a fresh timestamp (should print today's date/time)
python3 -c "import json; print(json.load(open('public/live-weather-cache.json'))['lastUpdated'])"

# 3. Commit + push (Vercel auto-deploys on push to main, ~2 min build)
git add public/live-weather-cache.json
git commit -m "Refresh live weather cache before judging"
git push origin main

# 4. Wait ~2 minutes, then confirm the LIVE site picked it up:
curl -s https://heatops.vercel.app/live-weather-cache.json | python3 -c "import json,sys; print(json.load(sys.stdin)['lastUpdated'])"
```

The last command's timestamp should be within the last few minutes. If you
do this 1–2 hours before your slot, the "updated Xh ago" labels on the live
site will stay well under the 24h staleness warning throughout judging.

## If you have more time and want it to self-refresh locally

Keep this running in a spare terminal during local dev/demo — it refreshes
the file automatically every 20 minutes (does NOT touch the deployed site,
only your local `npm run dev`):

```bash
node scripts/weatherCacheDaemon.mjs
```

## Why this is manual, not automatic

Vercel's free/Hobby plan caps Cron jobs at once per day, and a sub-daily
auto-refresh would need either a paid Pro plan or a new GitHub token wired
into a serverless function. Per your call, we're skipping that
infrastructure for now and doing one manual refresh before judging instead.
