# Data freshness before judging — what runs by itself, and the manual fallback

**Updated 1 Sept 2026.** The live site now refreshes itself; this page is the checklist to confirm it, plus the manual fallback if something is down.

## What runs automatically
- **Vercel Cron** — full refresh of all 1,932 cities at 09:00 UTC (14:30 IST, peak heat), and a **retry pass** at 10:30 UTC (16:00 IST) for any batch Open-Meteo rate-limited. Each run commits `public/live-weather-cache.json` + `public/data/history/YYYY-MM-DD.json` + `index.json` in one commit, which redeploys the site.
- **GitHub Actions every 3 hours** (`.github/workflows/`) — written and tested locally, but it needs a token with the `workflow` scope to be pushed:
  ```bash
  gh auth refresh -h github.com -s workflow
  git add .github && git commit -m "ci: 3-hourly weather refresh" && git push origin main
  ```
  Until that's pushed, the cron alone keeps the data ≤ 24 h old.
- Readings a run could not refresh are **carried forward and flagged** (`isCarriedForward`, real `observedAt`) — the UI shows their real age, never "fresh".
- Opening any state on the map refreshes that state's cities live (one batched call), so the demo state is always current regardless of the cron.

## Confirm it, the morning of judging
```bash
# last cron commits (expect one per day at ~09:00–10:00 UTC)
gh api "repos/kkrrishagarwal/heatops/commits?path=public/live-weather-cache.json&per_page=3" --jq '.[] | "\(.commit.author.date)  \(.commit.message | split("\n")[0])"'
# what the live site serves right now
curl -s https://heatops.vercel.app/live-weather-cache.json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('lastUpdated',j.lastUpdated,'cities',Object.keys(j.cities).length,'carriedForward',j.carriedForwardCount)})"
```
`carriedForwardCount` should be small (0–50). A few hundred means Open-Meteo rate-limited the run — the 16:00 IST retry or the next 3-hourly job fixes it.

## Manual fallback (only if the automation is down)
```bash
cd ~/Desktop/heatops
node scripts/refreshWeatherCache.mjs        # ~2 min; backs off on 429s, may take longer
git add public/live-weather-cache.json public/data/history
git commit -m "Refresh live weather cache before judging"
git push origin main                        # Vercel redeploys in ~2 min
```
If it hangs in rate-limit backoff for more than 10 minutes, stop it — the last committed cache stays live and is labelled with its age.

## Also before judging
- **Gemini key:** the free tier allows ≈ 20 requests/day per model. AGNI walks a 5-model chain, but a paid-tier key (`GEMINI_API_KEY` in Vercel) is the safe choice for a live demo.
- **Lite mode** is opt-in (avatar menu / ☰ drawer) for low-end phones; leave it off on the demo laptop.
- Hard-refresh the demo browser once after the last deploy (Ctrl + Shift + R).
