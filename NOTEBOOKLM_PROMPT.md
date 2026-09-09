# NotebookLM — what to upload and what to ask

## 1. Which file to upload

**Upload `SIH_2026_PPT_MASTER.md` — that one file, on its own.**

It is the consolidated file: every fact from all fifteen project markdown documents, deduplicated, with the numbers re-verified against the repo's actual data files. Uploading it alone gives NotebookLM one internally-consistent source.

**Do not upload the other markdown files alongside it.** They contain the same facts at older vintages — "36 states/UTs", "every 3 hours", "63 days of history", "36 cities of land cover" — and NotebookLM will average across the contradictions rather than pick the newest. Contradictory sources are how you get a deck that says two different things on two different slides.

### Optional second and third sources

Add these only if you want the specific things they carry:

| Add | Only if you want |
|---|---|
| `BhaskarOps_SIH2026_Idea_Submission.pdf` | NotebookLM to match the existing deck's structure and phrasing |
| `BHASKAROPS.md` (section 4) | The mermaid flowcharts, if you want it to describe the user journeys step by step |
| `BHASKAROPS.md` (section 6) | Deeper IMD / BHRIGU comparison and the equity-lens tables |

If you add any of them, paste this line into your first prompt:

> Where sources disagree on a number, `SIH_2026_PPT_MASTER.md` is authoritative and the others are older drafts.

---

## 2. The main prompt

Paste this into NotebookLM after uploading:

```
You are helping me build a presentation for Smart India Hackathon 2026 about
BhaskarOps, an urban heat monitoring and intervention platform for India.

Use ONLY the uploaded source. Do not add facts from your own knowledge, and do
not round, estimate or "improve" any number — this project's entire pitch is
built on every figure being traceable, so an invented number would defeat the
purpose. If something isn't in the source, say "not in the source" instead of
filling the gap.

Produce a slide-by-slide deck outline with these rules:

FORMAT PER SLIDE
- A title of at most 6 words
- 3 to 5 bullets, each at most 18 words
- One "speaker note" of 2-3 sentences written in plain spoken English
- One "visual" line naming what should be on screen (a screenshot, a flow
  diagram, a table, or a single big number)

CONTENT
Build 14 slides in this order:
1. Title and one-line positioning
2. The problem (who is hurt and why existing tools fall short)
3. Our USP in one line
4. What BhaskarOps does — the five-step loop
5. Two audiences, one product (Citizen vs Authority)
6. The Citizen journey, as a numbered flow
7. The Authority journey, as a numbered flow
8. The self-refreshing data pipeline, as a numbered flow
9. AGNI, the AI analyst — how a question gets grounded
10. Radical honesty enforced in code
11. Honest model disclosure (both R-squared scores)
12. Data sources and technology stack
13. How we differ from IMD and BHRIGU
14. Impact, feasibility and cost — then the closing line

TONE
Confident and specific. Prefer a concrete number over an adjective. Never write
"revolutionary", "cutting-edge", "game-changing" or "leveraging". Do not claim
the platform tracks the outcome of interventions after implementation — it does
not, and the source says so.
```

---

## 3. Follow-up prompts that work well

Ask these one at a time, after the outline:

**For the speaker script**
```
Write a 3-minute spoken script for slides 1 to 5 only. First person plural
("we built"), short sentences, no bullet points. Include the exact numbers from
the source. End on the sentence a judge should remember.
```

**For judge Q&A prep**
```
List the 10 hardest questions a technical judge could ask about BhaskarOps,
based only on the source. For each, give the honest answer the source supports
— including where the answer is a limitation we disclose rather than a strength.
Do not invent mitigations that aren't in the source.
```

**For the one-slide version**
```
Compress the entire project onto a single slide: 5 bullets maximum, one
headline number each. This is for a judge who gives us 60 seconds.
```

**For the Audio Overview**
```
Focus the audio overview on three things: why the honesty discipline is the
real differentiator rather than the AI, how the data pipeline refreshes itself,
and what a ward officer actually does with the Heat Action Plan checklist.
Skip the technology stack.
```

---

## 4. What NotebookLM will get wrong — check these

It is a summariser, so it drifts on exactly the things this project cares about:

| Watch for | The correct fact |
|---|---|
| "36 states" | **28 states and 8 UTs** (36 total) |
| "all 1,956 cities have live data" | 1,956 **covered**, **1,932** with live readings, 24 honestly blank |
| Dropping the −0.39 score | Both scores are always shown together: **R² 0.95 validation / −0.39 unseen cities** |
| "AI-powered heat mapping" as the USP | The USP is the honesty discipline plus closing the loop |
| "tracks whether the intervention worked" | **It does not.** No outcome tracking exists — do not let this into a slide |
| "real-time" | Say **live, refreshed hourly** through the Indian day |
| Calling the cooling model measured | It is an **illustrative model, labelled as such in the app** |

The last two rows matter most. If a slide claims something the app doesn't do, one judge clicking the live site finds it in seconds — and that costs you more than the claim ever gains.

---

## 5. Also worth doing in NotebookLM

- **Audio Overview** — generates a two-host podcast discussion of the project. Genuinely useful for rehearsing: you hear which parts of your own pitch sound thin when spoken aloud.
- **Study Guide** — turns the source into Q&A pairs. Good raw material for judge prep.
- **Briefing Doc** — a one-page executive summary if you need a text abstract for the portal.
