# Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Loop Closer the visual polish approved in `mockup-redesign.html` — new color tokens, heavier typography, stat tiles, section dividers, pill/ghost buttons, and icon bottom nav — across all six screens, with zero change to app behavior.

**Architecture:** Most of the visual lift comes from one CSS rewrite (`style.css`) — since every screen already shares the same `.card`/`.badge`/`.btn` classes, restyling those three classes alone uplifts every screen automatically with no markup changes. On top of that, a small number of screens (Today, Loop Inventory) get new markup for genuinely new elements (stat tiles, dividers, pill/ghost button variants) that don't exist in the current templates.

**Tech Stack:** Same as the base app — plain HTML/CSS/vanilla JS, no build step, no new dependencies, no webfonts (system font stack throughout, per the design spec).

---

## Task 1: Rewrite `style.css` with the new design tokens and components

**Files:**
- Modify: `style.css` (full rewrite)

- [ ] **Step 1: Replace the entire contents of `style.css`**

The existing `--color-danger`/`--color-success`/`--color-warning` values are intentionally left unchanged from the current file — those were already tuned to pass WCAG AA contrast as backgrounds under light badge text in an earlier pass, and reusing brighter values there would silently reintroduce that bug. The new `--color-stat-*` variables are separate and only ever used as text color on the dark card background (a different, easier contrast case), which is why they can be brighter.

The `--color-stat-cyan`/`--color-stat-amber` values (`#06b6d4`/`#f59e0b`) and `.btn.secondary`'s use of `--color-surface-2` below are both taken directly from the approved `mockup-redesign.html` — don't substitute other shades even if they'd also pass contrast; the point of this task is to match what was actually shown to and approved by the user, not to independently re-pick colors that happen to work. `--color-surface-2` gives secondary/pill buttons a visually distinct layer one shade lighter than the `.card` they usually sit inside (both currently use `--color-surface` for their background, which is why buttons need the lighter tone to read as separate from their card, not blend into it).

```css
:root {
  --color-bg: #0a0b0f;
  --color-surface: #16181f;
  --color-surface-2: #1e212b;
  --color-text: #f5f5f7;
  --color-text-dim: #8b8fa3;
  --color-primary: #4f46e5;
  --color-primary-light: #a5b4fc;
  --color-danger: #b91c1c;
  --color-success: #166534;
  --color-warning: #92400e;
  --color-border: #262a35;

  /* Stat-tile accent colors — text-only, on the dark surface background
     (Today's stat row). Not used as backgrounds, so they don't need the
     dark/saturated treatment the badge colors above use. */
  --color-stat-indigo: var(--color-primary-light);
  --color-stat-cyan: #06b6d4;
  --color-stat-amber: #f59e0b;

  --font-size-base: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 28px;
  --tap-min: 44px;
  --radius: 20px;
  --radius-sm: 12px;
  --spacing: 12px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: var(--font-size-base);
  overflow-x: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.view {
  display: none;
  flex: 1;
  padding: var(--spacing);
  padding-bottom: calc(var(--tap-min) + 24px);
}

.view.active {
  display: block;
}

h2 {
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 4px 0;
}

h3 {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 8px 0 4px;
}

h4 {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: -0.005em;
  margin: 10px 0 4px;
  color: var(--color-text-dim);
}

ul {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing);
}

.btn {
  min-height: var(--tap-min);
  padding: 0 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin: 6px 0;
}

.btn.secondary { background: var(--color-surface-2); color: var(--color-text); border: 1px solid var(--color-border); }
.btn.danger { background: var(--color-danger); }
.btn.success { background: var(--color-success); }

/* Pill: for lightweight, paired actions (Mark done / Not today, Ship it) —
   sized to content instead of spanning full width, but still meets the same
   44px tap-target minimum as every other button. */
.btn.pill {
  display: inline-block;
  width: auto;
  padding: 0 18px;
  margin: 4px 6px 4px 0;
}

/* Ghost: a lower-emphasis full-width action (e.g. "Activate" on a parked
   loop) — dashed border, transparent fill, reads as optional/secondary. */
.ghost-btn {
  display: block;
  width: 100%;
  min-height: var(--tap-min);
  padding: 0 16px;
  border-radius: var(--radius-sm);
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-dim);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  margin: 6px 0;
}

input, textarea, select {
  width: 100%;
  min-height: var(--tap-min);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
  margin: 6px 0;
}

textarea { min-height: 80px; }

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: var(--spacing);
}

/* Section divider: small-caps label + rule, used to group cards under a
   theme (e.g. Today's "Active Loop" vs "Quick tasks"). */
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 8px;
}
.divider span {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-dim);
  font-weight: 700;
  white-space: nowrap;
}
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

/* Stat row: 3 colour-coded tiles, used on Today. */
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: var(--spacing);
}
.stat {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 14px 8px;
  text-align: center;
}
.stat .stat-num {
  font-size: 1.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--color-stat-indigo);
}
.stat.cyan .stat-num { color: var(--color-stat-cyan); }
.stat.amber .stat-num { color: var(--color-stat-amber); }
.stat .stat-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-dim);
  font-weight: 700;
  margin-top: 6px;
}

/* Step history list (Loop Inventory): no bullets, step text left, date
   right, tabular-nums, a hairline between entries. */
.steps-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
}
.steps-list li:first-child { border-top: none; }
.steps-list .step-text { color: var(--color-text); }
.steps-list .step-date { color: var(--color-text-dim); font-variant-numeric: tabular-nums; flex: none; }

.nav-bottom {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.nav-bottom button {
  flex: 1;
  min-height: var(--tap-min);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 11px;
  font-weight: 600;
  padding: 6px 0;
}

.nav-bottom svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.nav-bottom button.active {
  color: var(--color-primary-light);
}

.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--spacing);
}

.modal-overlay.active {
  display: flex;
}

.modal-box {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 20px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-border);
  color: var(--color-text);
}

.badge.active { background: var(--color-primary); }
.badge.parked { background: var(--color-warning); }
.badge.killed { background: var(--color-danger); }
.badge.done { background: var(--color-success); }
```

- [ ] **Step 2: Manual verification**

Open the app via a local static server. Confirm: background is a deeper near-black, cards have visibly rounder corners with a subtle border, headings ("Today", "Loop Inventory", etc.) render noticeably bolder and larger than before, and the domain/killed/parking-lot `<ul>` lists on Settings and the Weekly Review modal no longer show bullet points. No functional change yet — this step is CSS only, so every existing button/link still works exactly as before, just restyled. Confirm no console errors.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: redesign visual tokens and shared components (cards, buttons, dividers, stat tiles)"
```

---

## Task 2: Add icons to the bottom nav

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the nav buttons and theme-color meta tag**

In `index.html`, change:

```html
  <meta name="theme-color" content="#0f1115">
```

to:

```html
  <meta name="theme-color" content="#0a0b0f">
```

Change:

```html
    <nav class="nav-bottom" id="bottom-nav">
      <button data-view="today">Today</button>
      <button data-view="inventory">Loops</button>
      <button data-view="parking-lot">Ideas</button>
      <button data-view="recap-log">Recap</button>
      <button data-view="settings">Settings</button>
    </nav>
```

to:

```html
    <nav class="nav-bottom" id="bottom-nav">
      <button data-view="today">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>
        Today
      </button>
      <button data-view="inventory">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/></svg>
        Loops
      </button>
      <button data-view="parking-lot">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2"/></svg>
        Ideas
      </button>
      <button data-view="recap-log">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 19V9M12 19V5M20 19v-6"/></svg>
        Recap
      </button>
      <button data-view="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
        Settings
      </button>
    </nav>
```

Note: `stroke="currentColor"` is intentionally omitted from each `<svg>` tag here because Task 1's CSS already sets it globally via `.nav-bottom svg { stroke: currentColor; }` — this keeps the icon's color in sync with the button's text color (dim by default, `--color-primary-light` when `.active`) automatically, with no per-icon markup needed.

- [ ] **Step 2: Manual verification**

Reload the app. Confirm each of the 5 bottom-nav buttons shows a small icon above its label, the icon and label share the same color, and switching tabs still works exactly as before (this step doesn't touch `app.js`'s nav click handling, which reads `data-view` — unchanged). Confirm the active tab's icon is tinted the light indigo color, not just the label text.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add icons to bottom nav"
```

---

## Task 3: Add a "this week" completion count to `loops.js`

**Files:**
- Modify: `loops.js` (add a new function after `computeStreak`)

- [ ] **Step 1: Add `computeWeekCompletionCount`**

In `loops.js`, right after the closing `}` of `computeStreak` (currently ending at line 168, right before the comment block for `computeConsecutiveMisses`), add:

```js

// Count of completed check-ins in the trailing 7-day window (today and the
// 6 days before it, inclusive) — used for the "X/7 this week" stat tile on
// Today. Unlike computeStreak, a gap doesn't stop the count early; this is
// a simple count over a fixed window, not a consecutive-run calculation.
export function computeWeekCompletionCount(loop, today = todayISODate()) {
  let count = 0;
  let cursor = new Date(today + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const dateStr = formatLocalDate(cursor);
    const entry = loop.checkin_history.find((c) => c.date === dateStr);
    if (entry && entry.action_completed) count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
```

- [ ] **Step 2: Manual verification via browser console**

```js
const s = await import('./storage.js');
const L = await import('./loops.js');
const data = s.defaultData();
const loop = L.createLoop(data, { title: 'Test loop', domain: 'Health', next_action: 'x', coping_plan: 'x', status: 'active' });

// Fabricate check-ins: today (2026-08-11) plus the 2 days before, completed;
// day before that, not completed; the rest of the 7-day window has no entry.
L.recordCheckin(data, loop.id, '2026-08-11', true);
L.recordCheckin(data, loop.id, '2026-08-10', true);
L.recordCheckin(data, loop.id, '2026-08-09', true);
L.recordCheckin(data, loop.id, '2026-08-08', false);

const count = L.computeWeekCompletionCount(loop, '2026-08-11');
console.assert(count === 3, 'expected 3 completed check-ins in the 7-day window, got ' + count);

console.log('computeWeekCompletionCount checks passed');
```

Confirm `computeWeekCompletionCount checks passed` prints with no assertion failures.

- [ ] **Step 3: Commit**

```bash
git add loops.js
git commit -m "feat: add computeWeekCompletionCount for the Today stat tile"
```

---

## Task 4: Today screen — stat row, divider, pill buttons

**Files:**
- Modify: `app.js:144-246` (`renderToday`)

- [ ] **Step 1: Replace `renderToday`**

Replace the entire function (currently lines 144-246) with:

```js
function renderToday() {
  const el = document.getElementById('view-today');
  const activeLoop = loops.getActiveLoop(data);
  const today = storage.todayISODate();

  let loopSection;
  if (activeLoop) {
    const todaysEntry = activeLoop.checkin_history.find((c) => c.date === today);
    const streak = loops.computeStreak(activeLoop, today);
    const weekCount = loops.computeWeekCompletionCount(activeLoop, today);
    const tasksOpen = data.tasks.filter((t) => !t.done).length;

    const statRow = `
      <div class="stat-row">
        <div class="stat">
          <div class="stat-num">${streak}</div>
          <div class="stat-label">Day streak</div>
        </div>
        <div class="stat cyan">
          <div class="stat-num">${weekCount}/7</div>
          <div class="stat-label">This week</div>
        </div>
        <div class="stat amber">
          <div class="stat-num">${tasksOpen}</div>
          <div class="stat-label">Tasks open</div>
        </div>
      </div>
    `;

    loopSection = `
      ${statRow}
      <div class="divider"><span>Active Loop</span></div>
      <div class="card">
        <span class="badge active">ACTIVE</span> <strong>${escapeHtml(activeLoop.title)}</strong>
        <p>${escapeHtml(activeLoop.next_action || '(no next action set)')}</p>
        ${todaysEntry
          ? `<p>Today: ${todaysEntry.action_completed ? 'Done ✓' : 'Not done'}</p>`
          : `<button class="btn success pill" id="today-mark-done">Mark done</button>
             <button class="btn secondary pill" id="today-mark-not-done">Not today</button>`
        }
        <button class="btn secondary pill" id="today-ship-btn">Ship it</button>
      </div>
    `;
  } else {
    loopSection = `
      <div class="card">
        <p>No active loop right now. Go to <strong>Loops</strong> to activate a parked one, or promote a Parking Lot idea during your Weekly Review.</p>
      </div>
    `;
  }

  const taskRows = data.tasks.map((t) => `
    <li>
      <label>
        <input type="checkbox" data-task-id="${t.id}" class="task-toggle" ${t.done ? 'checked' : ''}>
        <span style="${t.done ? 'text-decoration: line-through;' : ''}">${escapeHtml(t.title)}</span>
      </label>
      ${storage.isTaskStale(t, today) ? '<div class="badge parked">Open 14+ days — is this actually a Loop?</div>' : ''}
      <button class="btn secondary" data-delete-task-id="${t.id}">Delete</button>
    </li>
  `).join('');

  const reviewBanner = weeklyReview.isReviewDue(data)
    ? `<div class="card"><strong>Weekly Review is due.</strong> <button class="btn" id="start-review-btn">Start Review</button></div>`
    : '';

  el.innerHTML = `
    <h2>Today</h2>
    ${reviewBanner}
    ${loopSection}
    <div class="divider"><span>Quick tasks</span></div>
    <div class="card">
      <ul id="task-list">${taskRows || '<li>No tasks yet.</li>'}</ul>
      <input id="new-task-title" type="text" placeholder="New task">
      <button class="btn" id="add-task-btn">Add task</button>
    </div>
  `;

  const reviewBtn = el.querySelector('#start-review-btn');
  if (reviewBtn) reviewBtn.addEventListener('click', openWeeklyReviewModal);

  if (activeLoop) {
    const doneBtn = el.querySelector('#today-mark-done');
    const notDoneBtn = el.querySelector('#today-mark-not-done');
    if (doneBtn) doneBtn.addEventListener('click', () => {
      loops.recordCheckin(data, activeLoop.id, today, true);
      save();
      promptTomorrowNextAction(activeLoop.id);
    });
    if (notDoneBtn) notDoneBtn.addEventListener('click', () => {
      loops.recordCheckin(data, activeLoop.id, today, false);
      save();
      renderToday();
      checkStuckOrBored();
    });
    const shipBtn = el.querySelector('#today-ship-btn');
    if (shipBtn) shipBtn.addEventListener('click', () => openShipFlow(activeLoop));
  }

  el.querySelectorAll('.task-toggle').forEach((cb) => {
    cb.addEventListener('change', () => {
      storage.toggleTask(data, cb.dataset.taskId);
      save();
      renderToday();
    });
  });

  el.querySelectorAll('[data-delete-task-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      storage.deleteTask(data, btn.dataset.deleteTaskId);
      save();
      renderToday();
    });
  });

  el.querySelector('#add-task-btn').addEventListener('click', () => {
    const input = el.querySelector('#new-task-title');
    const title = input.value.trim();
    if (!title) return;
    storage.addTask(data, { title });
    save();
    renderToday();
  });
}
```

Everything below the function (`promptTomorrowNextAction` onward) is unchanged — only `renderToday` itself is being replaced. Note two intentional differences from the current version: the "Quick tasks" `<h3>` inside the card is replaced by a `.divider` above the card (matching the mockup's pattern), and the old `<p>Streak: N days</p>` line is removed since the streak now lives in the stat row — showing it twice would be redundant.

- [ ] **Step 2: Manual verification**

With an onboarded profile with an active loop, open Today. Confirm: a 3-tile stat row appears above "Active Loop" (streak, this-week X/7, tasks-open), each tile a different color (indigo/cyan/amber), "Active Loop" and "Quick tasks" both appear as small-caps dividers with a rule (not headings inside cards), and "Mark done"/"Not today"/"Ship it" render as pill-shaped buttons sitting inline rather than full-width blocks — but still tall enough to tap comfortably (inspect one in devtools and confirm computed height is at least 44px). Click through Mark done → tomorrow's-action modal → confirm the stat row's numbers update correctly on the next render. Add and complete a task, confirm "Tasks open" updates. Confirm the empty-state (no active loop) card is unchanged from before (no stat row, since there's nothing to show stats for).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: redesign Today screen with stat tiles, dividers, and pill buttons"
```

---

## Task 5: Loop Inventory — ghost button and styled step list

**Files:**
- Modify: `app.js:379-405` (inside `renderInventory`'s `rows` computation)

- [ ] **Step 1: Update the step-history and Activate button markup**

In `renderInventory`, find (currently lines 379-405):

```js
  const rows = filtered.map((l) => {
    let detail = '';
    if (l.status === 'active') detail = `Next: ${escapeHtml(l.next_action)}`;
    else if (l.status === 'parked') detail = `Resume: ${escapeHtml(l.resumption_plan)}`;
    else if (l.status === 'killed') detail = `Reason: ${escapeHtml(l.kill_reason)}${l.kill_note ? ' — ' + escapeHtml(l.kill_note) : ''}`;
    else if (l.status === 'done') detail = `Reflection: ${escapeHtml(l.ship_reflection)}`;

    const actionLog = l.action_log || [];
    const expanded = inventoryExpandedSteps.has(l.id);
    const stepsSection = actionLog.length
      ? `
        <button class="btn secondary" data-toggle-steps="${l.id}">${expanded ? 'Hide' : 'Show'} steps (${actionLog.length})</button>
        ${expanded ? `<ul>${actionLog.map((a) => `<li>${escapeHtml(a.date)} — ${escapeHtml(a.text)}</li>`).join('')}</ul>` : ''}
      `
      : '';

    return `
      <div class="card">
        <span class="badge ${l.status}">${l.status.toUpperCase()}</span>
        <span class="badge">${escapeHtml(l.domain)}</span>
        <h3>${escapeHtml(l.title)}</h3>
        <p>${detail}</p>
        ${stepsSection}
        ${l.status === 'parked' && !hasActive && !loops.hasUnresolvedParkedLoop(data, l.id) ? `<button class="btn" data-activate-id="${l.id}">Activate</button>` : ''}
      </div>
    `;
  }).join('');
```

Replace with:

```js
  const rows = filtered.map((l) => {
    let detail = '';
    if (l.status === 'active') detail = `Next: ${escapeHtml(l.next_action)}`;
    else if (l.status === 'parked') detail = `Resume: ${escapeHtml(l.resumption_plan)}`;
    else if (l.status === 'killed') detail = `Reason: ${escapeHtml(l.kill_reason)}${l.kill_note ? ' — ' + escapeHtml(l.kill_note) : ''}`;
    else if (l.status === 'done') detail = `Reflection: ${escapeHtml(l.ship_reflection)}`;

    const actionLog = l.action_log || [];
    const expanded = inventoryExpandedSteps.has(l.id);
    const stepsSection = actionLog.length
      ? `
        <button class="btn secondary pill" data-toggle-steps="${l.id}">${expanded ? 'Hide' : 'Show'} steps (${actionLog.length})</button>
        ${expanded ? `<ul class="steps-list">${actionLog.map((a) => `<li><span class="step-text">${escapeHtml(a.text)}</span><span class="step-date">${escapeHtml(a.date)}</span></li>`).join('')}</ul>` : ''}
      `
      : '';

    return `
      <div class="card">
        <span class="badge ${l.status}">${l.status.toUpperCase()}</span>
        <span class="badge">${escapeHtml(l.domain)}</span>
        <h3>${escapeHtml(l.title)}</h3>
        <p>${detail}</p>
        ${stepsSection}
        ${l.status === 'parked' && !hasActive && !loops.hasUnresolvedParkedLoop(data, l.id) ? `<button class="ghost-btn" data-activate-id="${l.id}">Activate</button>` : ''}
      </div>
    `;
  }).join('');
```

No changes to the event-wiring block below this (the `data-toggle-steps`/`data-activate-id` listeners still target the same attribute names, unaffected by the class changes).

- [ ] **Step 2: Manual verification**

Go to Loop Inventory with a loop that has a multi-entry step history. Confirm "Show steps (N)" renders as a pill rather than a full-width button, and expanding it shows each step with the step text on the left and the date on the right (not "date — text" run together), with a thin rule between rows and no bullet points. With a parked, never-active loop present (no active loop currently), confirm its "Activate" button now has a dashed border and transparent background instead of a solid fill, and still works when clicked.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: redesign Loop Inventory step list and Activate button"
```

---

## Task 6: Cross-screen visual QA pass

**Files:** None expected — this is a verification-only task. If a genuine visual defect is found (not a style preference, an actual defect: unreadable text, broken layout, horizontal scroll, a tap target under 44px), fix it with the smallest possible CSS-only change and note what was fixed. Do not add new components or restructure any screen's markup in this task — that would mean an earlier task's design was incomplete, not that this task needs new scope.

- [ ] **Step 1: Walk through every screen and modal**

Clear site data and go through, at a 375px mobile viewport width:

1. **Onboarding** — collect phase and decide phase (all three cards: active/park/kill). These get no markup changes in this plan, so confirm they still look correct purely from Task 1's CSS refresh: rounder cards, bolder headings, no bullet artifacts.
2. **Today** — already covered in Task 4's verification; re-confirm here alongside everything else for a full-app pass.
3. **Loop Inventory** — already covered in Task 5's verification; also check the "+ New Loop" modal and "Activate" modal (`openNewLoopModal`, `openActivateModal`) — these weren't touched by any task, confirm they still render correctly with the new card/button styling from Task 1.
4. **Idea Parking Lot** — capture form and existing entries.
5. **Weekly Review** — force review-due state (see the original build plan's Task 12 verification technique if needed), confirm the review modal's killed-loops and parking-lot `<ul>` lists show no bullets and read cleanly, confirm the promote modal still works.
6. **Weekly Recap Log** — confirm past recap entries still display correctly.
7. **Settings** — confirm the domains `<ul>` shows no bullets, confirm all buttons and inputs still meet the 44px minimum, confirm export/import still work (this task doesn't touch any logic, but re-confirming end-to-end is cheap insurance).
8. **Stuck-or-bored and ship-flow modals** — trigger both (see original plan Tasks 8/9 verification techniques), confirm they render with the new palette and no layout breakage.

For each, also confirm: no horizontal scroll at 375px width, and reloading the page doesn't lose any data (this task makes no data-model changes, so this should trivially hold, but confirm anyway as the final check of the whole plan).

- [ ] **Step 2: Commit (only if Step 1 required a fix)**

If Step 1 found and fixed a genuine defect:

```bash
git add style.css
git commit -m "fix: <describe the specific visual defect fixed during QA>"
```

If no fix was needed, skip this step — there's nothing to commit.
