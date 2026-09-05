# Data freshness before judging — what runs by itself, and the manual fallback

**Updated 1 Sept 2026.** The live site now refreshes itself; this page is the checklist to confirm it, plus the manual fallback if something is down.

## What runs automatically
- **Vercel Cron** — full refresh of all 1,932 cities at 09:00 UTC (14:30 IST, peak heat), and a **retry pass** at 10:30 UTC (16:00 IST) for any batch Open-Meteo rate-limited. Each run commits `public/live-weather-cache.json` + `public/data/history/YYYY-MM-DD.json` + `index.json` in one commit, which redeploys the site.
- **GitHub Actions every 3 hours** (`.github/workflows/refresh-weather.yml`, live since 5 Sept) — at :30 past every third hour it refreshes all cities from Open-Meteo, commits the cache + daily snapshot as `kkrrishagarwal`, and pushes, which redeploys the site. Check it: `gh run list --workflow refresh-weather.yml --limit 3` (or the Actions tab). Trigger by hand: `gh workflow run refresh-weather.yml`.
- **Laptop cron stopgap (4 Sept):** `scripts/localAutoRefresh.sh` runs from this laptop's crontab at :17 past every 3rd hour — paced refresh, commit, push, redeploy. It only works while the laptop is **on and online**; check `tail ~/.heatops-autorefresh.log`. The Vercel cron produced no commits on 2–4 Sept; the GitHub Actions workflow is now the primary refresh and this laptop cron is the backup.

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

## Showing the Extreme state on demand
Judges may visit on a mild day. Open the site as `https://heatops.vercel.app/?demoTemp=46` and pick any city — that browser tab treats it as 46 °C (checklist goes ACTIVE, citizen card urgent, theme red) with a visible "🧪 DEMO — not real data" banner. `?demoTemp=5` shows the cold-weather tier. Per-city version for the stage: `https://heatops.vercel.app/?demo=Leh:-8,Sri%20Ganganagar:46` — Leh reads −8 °C (cold protocol), Sri Ganganagar 46 °C (full activation), every other city stays real. Remove the parameter to return to live readings; nothing is ever written to the real data.

## Also before judging
- **Gemini key:** the free tier allows ≈ 20 requests/day per model. AGNI walks a 5-model chain, but a paid-tier key (`GEMINI_API_KEY` in Vercel) is the safe choice for a live demo.
- **Lite mode** is opt-in (avatar menu / ☰ drawer) for low-end phones; leave it off on the demo laptop.
- Hard-refresh the demo browser once after the last deploy (Ctrl + Shift + R).

## On the morning of the demo
Follow the pre-demo checklist at the end of `DEMO_SCRIPT.md` after the freshness check above.

## What the first Actions runs showed (5 Sept)
| Run | Carried forward | Note |
|---|---|---|
| 2 (08:05 UTC) | 900 | first green run; 31 batches died with a bare "fetch failed" |
| 3 (08:40 UTC) | 932 | same, before any fix |
| 4 (09:15 UTC) | 750 | cause now logged: `UND_ERR_CONNECT_TIMEOUT` to api.open-meteo.com from the runner |

The laptop never sees these; GitHub's runners intermittently fail to *connect* to Open-Meteo. From run 5 the script retries a connection failure three times (10/20/40 s) before giving a batch up, on top of the existing halves pass. If a run still carries several hundred cities forward, re-run it by hand (`gh workflow run refresh-weather.yml`) — each run gets a different runner and a different IP.
