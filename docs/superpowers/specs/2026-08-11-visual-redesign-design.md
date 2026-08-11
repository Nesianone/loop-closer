# Visual Redesign — Design Spec

**Date:** 2026-08-11
**Reference:** Approved mockup, `mockup-redesign.html` (committed to repo for reference; will be deleted once the real redesign ships)

## Problem

The current visual design (Task 1 of the original build) is functional but plain — system-default typography, flat rectangular buttons, minimal card treatment, text-only bottom nav. The user compared it against a different, more polished personal app and asked for a visual redesign in that direction. A mockup covering the Today and Loop Inventory screens was built and approved.

This is a **visual-layer-only** change. Nothing about the app's data model, lifecycle rules, event wiring, or behavior changes — every rule (one active loop, forced decisions, the promotion loophole guard, etc.) stays exactly as built. This spec covers `style.css`, the bottom nav markup in `index.html`, and the HTML templates each `render*`/`open*Modal` function in `app.js` produces.

## Scope

Applied consistently across **all six screens** (Onboarding, Today, Loop Inventory, Idea Parking Lot, Weekly Review, Weekly Recap Log, Settings) and their modals — not just the two shown in the mockup, since a partial redesign would look inconsistent and unfinished. The mockup's two screens are the reference; every other screen adopts the same design tokens and component patterns, applied where they make sense for that screen's actual content (e.g. Loop Inventory doesn't get a "streak" stat tile — it has no daily-check-in concept — but it does get the new card/badge/steps-toggle treatment).

## Design Tokens

Replacing `style.css`'s `:root` variables:

```css
--bg: #0a0b0f;          /* was #0f1115 — slightly deeper */
--surface: #16181f;     /* was #1a1d24 */
--surface-2: #1e212b;   /* new — nested/secondary surface, e.g. quick-task rows, pill backgrounds */
--text: #f5f5f7;        /* was #f2f2f5 */
--text-dim: #8b8fa3;    /* was #a0a4ae */
--border: #262a35;      /* was #2a2d36 */

--accent: #4f46e5;          /* unchanged — indigo stays the brand color */
--accent-light: #a5b4fc;    /* was #818cf8 — lighter, used for stat numbers and nav active-state on the darker bg */
--accent-2: #06b6d4;        /* new — cyan, second stat tile */
--accent-3: #f59e0b;        /* new — amber, third stat tile */

--success: #22c55e;     /* was #166534 — brighter, reads better on the deeper bg */
--warning: #f59e0b;     /* was #92400e */
--danger: #f87171;      /* was #b91c1c */
```

All existing WCAG-AA contrast fixes from the original build (Task 1's contrast pass) carry forward — every new/changed color pairing below is re-checked against AA 4.5:1 before implementation, the same discipline as the original build.

**Typography:** still system font stack (no webfonts — stays consistent with "no external dependencies"), but headings (`h2`, `h3`, screen titles) move to `font-weight: 800`, tighter `letter-spacing: -0.02em`, and a larger scale for the top-level screen title. Small labels (section dividers, badges, stat labels) use `letter-spacing: 0.08em`, uppercase, `font-weight: 700`, `font-size: ~0.65-0.7rem`.

**Radius:** cards move from the current smaller radius to `20px`. Buttons/pills keep enough radius to read as pills (`12px` for rectangular action buttons inside cards, `999px` for true pills like badges).

**Tap targets:** the existing 44px minimum height rule is preserved on every interactive element — the pill-style buttons in the mockup are visually lighter but still meet the same height requirement as the current `.btn` class.

## New Components

- **`.stat-row` / `.stat`** — a 3-column grid of stat tiles, each with a large tabular-number value and a small uppercase label underneath, colored per tile (indigo/cyan/amber). Used on the Today screen: **streak** (already computed via `loops.computeStreak`), **this week** (new: `X/7` — count of the active loop's completed check-ins in the last 7 calendar days, same 7-day-window logic already used in `weekly-review.js`'s recap generation, just surfaced directly on Today instead of only in the weekly recap), and **tasks open** (new but trivial: `data.tasks.filter(t => !t.done).length`).
- **`.divider`** — a small-caps label followed by a horizontal rule, used to separate thematic groups of cards on a screen (e.g. Today's "Active Loop" section from its "Quick Tasks" section).
- **Updated `.card`** — larger radius, subtle border instead of a flat fill, more internal padding.
- **Updated `.badge`** — unchanged data/meaning (status pills, domain pills), refreshed sizing/color to match the new palette.
- **Pill action buttons** — buttons that live inside a card (Mark done, Not today, Activate, etc.) move from full-width rectangles to inline pills, sized to content but still meeting the 44px tap-target minimum.
- **Bottom nav icons** — each of the 5 tabs (Today, Loops, Ideas, Recap, Settings) gets a small inline SVG line-icon above its label, plus the existing text label. Icons are simple, single-color (`currentColor`), no new asset files — inlined directly in `index.html`.

## What does NOT change

- Every screen's actual content, copy, fields, and validation rules.
- Every event handler, data flow, and function signature in `app.js`, `loops.js`, `storage.js`, `weekly-review.js`.
- The PWA shell (manifest, service worker, icons).
- The dismissible-vs-forced modal distinction and every existing behavioral rule.
- `guide.html` (the user guide) keeps its own current look — it's a separate document, not part of the app shell, and re-skinning it isn't part of this scope unless requested later.

## Testing

Same as the rest of the project: no automated test suite, manual verification via browser preview — confirm each screen visually matches the new token system, confirm no horizontal scroll and all tap targets still measure ≥44px at a 375px mobile viewport, confirm both the "already reviewed" WCAG-AA contrast discipline and every existing functional flow (documented in earlier plans) still works unchanged.
