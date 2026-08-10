# Step History Log — Design Spec

**Date:** 2026-08-10
**Related:** `docs/superpowers/specs/2026-08-09-loop-closer-design.md` (base Loop Closer spec)

## Problem

A Loop's `next_action` field only ever holds the *current* physical step and gets overwritten every time it changes. For a multi-step project (e.g. "Renovate toilet": fill holes → add panels → paint panels → add acoustic panel), there's no way to look back afterward and see the sequence of steps actually taken — only that check-ins happened on certain days.

## Data Model Change

Add one new field to `Loop`:

```js
Loop {
  ...existing fields unchanged...
  action_log: [{ date: ISO date string (YYYY-MM-DD, local), text: string }]
}
```

- `action_log` starts as `[]` on every new loop (created via `createLoop`).
- Existing loops created before this feature simply have an empty `action_log` — no migration needed, no backfill.
- Append-only: entries are never edited, reordered, or deleted. This mirrors the existing Weekly Recap Log's append-only convention.

## When Entries Get Appended

An entry `{ date: todayISODate(), text }` is appended to `action_log` any time a loop's `next_action` is set to a non-empty value, via:

1. **`createLoop`** — if `next_action` is provided at creation (loop made active with an initial next step).
2. **`setNextAction`** — every call (covers: the forced tomorrow's-next-action prompt after marking a check-in done, and the "shrink the next action" path in the stuck-or-bored flow).

Both of these already exist in `loops.js`; the log entry is a small addition to each, not a new code path. Blank/empty `next_action` values are not logged (matches existing behavior where next_action can be empty for a newly-parked-then-reactivated loop with no step chosen yet).

## Display: Loop Inventory

Each loop card gains a "Show steps (N)" toggle, shown only when `action_log.length > 0` (N is the count). Collapsed by default. Expanding it reveals the list in chronological order (oldest first), each line showing the date and the step text — read top-to-bottom like a log of what was actually done, e.g.:

```
2026-08-01  Fill holes in wall
2026-08-03  Add panels
2026-08-05  Paint panels
2026-08-07  Add acoustic panel
```

This is available for loops in any status (active, parked, killed, done) — a finished or abandoned project's full step trail remains visible afterward. It does not replace or duplicate the existing status-specific detail line (Next/Resume/Reason/Reflection) already shown on each card — it's an additional, collapsed section.

## Explicitly Out of Scope

- No editing, reordering, or deleting log entries.
- No pre-planning a checklist of future steps — the log only ever records what was actually set as the current step, after the fact.
- No display on the Today screen (per the user's choice, Loop Inventory only).
- No change to `checkin_history` (the separate day-by-day completed/not-completed record) — the two remain independent data streams.

## Testing

Consistent with the base spec's approach: no automated test suite, manual verification via browser preview (set several next actions in sequence on a loop, confirm the log accumulates correctly in order; confirm it persists across reload; confirm it's visible on parked/killed/done loops too).
