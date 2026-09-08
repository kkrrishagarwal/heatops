# Image prompts for Gemini / ChatGPT — BhaskarOps SIH deck

## How to use these

1. Paste the **STYLE BLOCK** first, then the diagram prompt under it. Using the same style block
   every time is what makes all your images look like one deck instead of six unrelated pictures.
2. Ask for **no text in the image**. Type the labels yourself in PowerPoint on top.
3. Generate, then place in PowerPoint → `Insert → Text Box` for each label.

**Why no text:** image models still garble words inside diagrams. The Gemini deck produced
*"Requests Open-Meteo perpicual motion engine"* inside its best graphic, and that cannot be edited
once it is a picture. Shapes from the model + your own text boxes = no risk.

---

## STYLE BLOCK — paste this at the top of every prompt

```
Flat vector infographic in a clean, professional government-report style.
Pure white background. Single accent colour burnt orange (#B45309), secondary
dark navy (#0F2338), thin light grey-blue borders (#C9D6E4). Thin clean lines,
generous white space, evenly balanced composition. No gradients, no glow, no 3D,
no drop shadows, no photographic elements, no people, no icons of the sun or
thermometers. 16:9 landscape.

Do not render any text, letters, words, numbers or labels anywhere in the image.
Leave clear empty space beside each element so captions can be added later.
```

---

## 1 · Circular process cycle — the self-refreshing data engine

```
A five-step circular process diagram. Five equal circles spaced evenly around one
thin ring, connected by arrows flowing clockwise. Each circle is a plain outlined
circle, white filled, burnt-orange stroke. The ring is a thin dashed line. The
centre of the ring is completely empty. Wide empty margins on the left and right
of the ring for captions.
```

*If you want the numerals:* add — `The only text permitted is the single digits 1, 2, 3, 4 and 5, one inside each circle. No other characters anywhere.`

---

## 2 · Horizontal five-step flow — the monitor → act loop

```
Five equal rounded rectangles in a single horizontal row, evenly spaced, joined by
small arrows pointing right between them. All boxes empty with thin grey-blue
borders and a very light fill. The fifth box on the right has a burnt-orange border
to mark it as the final step. Nothing else in the image.
```

---

## 3 · Ascending staircase — the NOW → PILOT → SCALE roadmap

```
A minimal ascending roadmap: three flat horizontal platforms rising from lower-left
to upper-right, like three steps of a staircase seen straight on. A single thin
burnt-orange line connects them, with a small filled dot marking each platform.
Each platform is a plain rounded rectangle. Generous empty space above and to the
right of each platform for captions. Nothing else in the image.
```

---

## 4 · Three-column comparison — IMD vs BHRIGU vs BhaskarOps

```
Three tall equal rectangular panels side by side with a small gap between them.
All three have thin grey-blue borders and a very light fill. The third panel on the
right has a burnt-orange border and a slightly warmer fill to mark it as the
highlighted option. Each panel is completely empty inside, with a thin horizontal
divider line near the top of each. Nothing else in the image.
```

---

## 5 · Four severity tiers — the action playbook

```
Four horizontal bars stacked vertically, evenly spaced, each with a thick coloured
strip down its left edge. The strips from top to bottom are: deep red, amber,
green, light blue. The bars themselves are white with thin grey borders and are
completely empty inside. Clean and minimal, nothing else in the image.
```

---

## 6 · Three audience cards — citizens, officials, planners

```
Three equal rectangular cards side by side, evenly spaced. Each card has a thin
grey-blue border, a very light fill, and a thin burnt-orange bar across the top
edge. All three cards are completely empty inside. Generous internal padding.
Nothing else in the image.
```

---

## 7 · Split journey — citizen phone vs authority laptop

```
A simple split composition: on the left, the plain outline of a smartphone in
portrait; on the right, the plain outline of an open laptop. Both drawn as thin
flat vector outlines in dark navy on white, with completely blank screens. A thin
vertical dashed divider line runs between them, and a small rounded rectangle sits
centred at the top spanning the divider. No text, no icons, no user interface
elements, nothing on either screen.
```

*Then place your real screenshots inside the blank screens in PowerPoint.*

---

## 8 · Before / after metric pair

```
Two equal small rectangular cards side by side, thin grey-blue borders, very light
fill, completely empty inside. A single small burnt-orange arrow pointing right
sits centred inside each card. Minimal, clean, nothing else in the image.
```

---

## If you insist on text inside the image

Only do this for a diagram with **very few, very short** labels, and proofread every character
before it goes in the deck.

```
[STYLE BLOCK, but delete the "no text" paragraph]

... your diagram description ...

The image must contain exactly these five words and nothing else, one per box,
spelled exactly as written: MONITOR, EXPLAIN, COMPARE, SIMULATE, ACT.
Use a clean bold sans-serif. Do not add any other words, letters or numbers.
```

Then read every word in the result. If a single letter is wrong, regenerate — do not ship it.

---

## Practical tips

| Problem | Fix |
|---|---|
| Model adds random words anyway | Regenerate. Add: *"Absolutely no typography of any kind."* |
| Colours drift between images | Always paste the same STYLE BLOCK; name the hex codes every time |
| Image comes out square | Add: *"Wide 16:9 landscape aspect ratio, not square."* |
| Too decorative / futuristic | Add: *"Plain and restrained, like a printed government report, not a tech startup."* |
| Background isn't white | Add: *"Solid pure white background, no transparency, no texture."* |
| Elements crammed together | Add: *"At least 15% empty margin around the whole composition."* |

---

## Honest ranking of your options

1. **Use `docs/diagrams/` — 9 PNGs already made.** Correct numbers, correct spelling, matched to your data.
2. **PowerPoint SmartArt** — `Insert → SmartArt → Cycle` (data engine) or `→ Process` (five-step loop).
   Stays sharp at any zoom, editable, inherits the template's fonts.
3. **These prompts** — good when you want a look the first two can't give you.
