# Loop Closer — Design Spec

**Date:** 2026-08-09
**User:** terryd@gmail.com
**Working title:** Loop Closer

## Problem

Single-user personal tool to counter a documented pattern of starting projects/courses/jobs and abandoning them near the finish line (chasing new ideas, losing interest, or hitting a technical wall). The app makes switching harder than finishing, and keeps a visible, honest record of what was actually completed vs abandoned.

## Tech Stack

- Plain HTML/CSS/vanilla JS, no build step, no frameworks, no bundler.
- Single-page app: one `index.html` with JS-driven view switching between screens (no page reloads, no router library).
- Installable PWA: `manifest.json` + `service-worker.js` (app-shell caching, cache-first).
- Storage: one JSON blob in `localStorage` (key `loopcloser_data`). No backend, no IndexedDB — data volume (a dozen loops, a handful of tasks, weekly recaps over months) is small and structured, so a single synchronous blob is simpler than IndexedDB for no real benefit at this scale. If this changes later, revisit.
- No login/auth — single user, personal device.
- Deploy target: GitHub Pages.

## Data Model

```js
Loop {
  id: string,
  title: string,
  domain: string,               // one of Settings.domains (editable list; default: Career/Skill-building, Financial, Home/Physical, Health, Community)
  status: 'active' | 'parked' | 'killed' | 'done',
  next_action: string,
  coping_plan: string,          // "if I get stuck on X, then I will Y" — required on create and whenever set to active
  resumption_plan: string,      // required when set to parked
  kill_reason: 'lost interest' | 'wasn't the right idea' | 'hit a wall I couldn't clear' | 'other',
  kill_note: string,            // optional, required only if kill_reason === 'other'
  ship_reflection: string,      // "why does this matter to you" — required when set to done
  created_date: ISO string,
  status_changed_date: ISO string,
  checkin_history: [{ date: ISO date, action_completed: bool }]
}

Task {
  id: string,
  title: string,
  done: bool,
  created_date: ISO string,
  due_date: ISO string | null
}

ParkingLotEntry {
  id: string,
  title: string,
  note: string,
  created_date: ISO string
}

WeeklyRecapEntry {               // append-only, never edited or deleted
  date: ISO string,
  active_loop_summary: string,   // what got done that week on the active loop
  parked_or_killed: [{ title, status, reason }],
  new_parking_lot_entries: [string],
  tasks_completed: [string]
}

Settings {
  domains: string[],
  reviewDay: 0-6,                 // day of week, default Sunday
  onboarded: bool,
  lastReviewShownWeek: string     // ISO week identifier, prevents re-triggering review same week
}

AppData {                         // the single object persisted to localStorage['loopcloser_data']
  loops: Loop[],
  tasks: Task[],
  parkingLot: ParkingLotEntry[],
  weeklyRecaps: WeeklyRecapEntry[],
  settings: Settings
}
```

**Invariant:** at most one `Loop` with `status === 'active'` at any time, enforced in `storage.js`, not just the UI.

## File Structure

```
LoopCloser/
├── index.html          # Shell + all screen containers + bottom nav
├── style.css           # CSS variables, mobile-first, 44px+ tap targets, high contrast
├── app.js              # View routing, event wiring, top-level init
├── storage.js          # Single async-free wrapper: load/save/export/import the localStorage blob
├── loops.js            # Loop lifecycle logic: activate/park/kill/ship, streak + missed-checkin detection
├── weekly-review.js    # Review-day detection, recap generation, promotion from parking lot
├── manifest.json
├── service-worker.js   # App-shell caching (cache-first)
└── icons/              # 192x192 and 512x512
```

## Screens / Flows

1. **Onboarding audit** (first launch only, gated by `settings.onboarded`): dump every unfinished thing (6-10 typical). Each entry immediately forced through a decision: active (only one allowed) / parked (needs resumption_plan) / killed (needs kill_reason). Nothing left undecided.
2. **Today / Dashboard**: active loop's `next_action` with one-tap done/not-done. Marking done immediately prompts for tomorrow's `next_action` before leaving the screen. Shows quick tasks list and a streak counter (consecutive days with a completed check-in, no other gamification). Surfaces the Weekly Review banner when due.
3. **Loop Inventory**: all loops, filterable by status and domain. Starting a new active loop is blocked until the current active loop is explicitly parked/killed/shipped first.
4. **Stuck-or-bored check**: 2 consecutive missed check-ins on the active loop triggers a blocking modal on Today: "stuck or losing interest?" — stuck → shrink `next_action`; losing interest → forces park or kill right there.
5. **Scruffy finish prompt**: marking active loop done/shipped asks "would you ship this today at B-minus quality?" then a short "why does this matter to you" (`ship_reflection`) before final confirm. Status becomes `done`; active slot frees up.
6. **Idea Parking Lot**: one-tap capture (title + note) any time. Not otherwise reviewable/actionable except during Weekly Review.
7. **Weekly Review**: triggered on `settings.reviewDay` (default Sunday), once per ISO week. Surfaces current loop's week progress, this week's kill reasons, and the Parking Lot. Only here can a parking lot item be promoted to active — and only if the current active loop is `done` or `killed`.
8. **Weekly Recap log**: permanent scrollable history of every auto-generated `WeeklyRecapEntry`, append-only, never edited/deleted.
9. **Settings**: edit domain tags, set review day, export/import JSON backup.

## Missed Check-in Detection

Calendar-gap based, computed on app load — no push notifications (unreliable across platforms without a backend). For the active loop, walk each calendar day from `status_changed_date` (or last check-in) to today; any day with no `checkin_history` entry counts as a miss. Two consecutive misses trigger flow #4.

## Error Handling / Edge Cases

- Corrupt or missing `localStorage` data → app falls back to a fresh empty `AppData` shape rather than crashing.
- JSON import validates shape (top-level keys, array types) before overwriting existing data; rejects malformed files with a message and does not touch existing data on failure.
- Task 14-day-old flag ("is this actually a Loop?") is a non-blocking banner on the task row — never forces a decision the way loop transitions do.
- No active loop (all parked/killed/done) is a valid state — Today screen shows an empty/prompt state directing to Loop Inventory or Weekly Review to activate one.

## Testing

No build tooling, no automated test suite for v1 — manual verification via browser preview of: onboarding queue, one-active-loop enforcement, park/kill/ship transitions with required fields, stuck-or-bored trigger, weekly review trigger + recap generation + promotion, export/import round-trip.

## Explicitly Out of Scope (Phase 2)

- Sending digests to another person.
- Temptation bundling features.
- Blocking/restricting access to external course sites.
- Points/badges/gamification beyond the streak count.
- Multi-user support, cloud sync, or accounts.
