# Loop Closer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, installable PWA that enforces the Loop/Task lifecycle described in `docs/superpowers/specs/2026-08-09-loop-closer-design.md`, deployable to GitHub Pages.

**Architecture:** Single `index.html` shell with JS-driven view switching between 9 screens, a bottom tab nav, and one JSON blob in `localStorage` as the persistence layer. Pure logic (lifecycle rules, streaks, weekly review) lives in dependency-free modules (`storage.js`, `loops.js`, `weekly-review.js`) so it can be exercised from the browser console independently of the UI. `app.js` wires DOM events to those modules and re-renders the active view.

**Tech Stack:** Plain HTML/CSS/vanilla JS (ES modules via `<script type="module">`), no build step, no npm, no frameworks. Manifest + service worker for PWA installability.

**Testing approach:** Per the approved spec, there is no automated test suite for v1. Every task ends with a manual verification step using the browser preview (devtools console + UI interaction) instead of an automated test. Do not add a test framework or npm — that would violate the "no build tools" constraint.

---

## Task 1: Project scaffold & PWA shell

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `manifest.json`
- Create: `service-worker.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`
- Create: `app.js` (empty entry point for now)

- [ ] **Step 1: Generate placeholder icons**

There's no image tool in this stack, so generate simple solid-color PNGs with a tiny inline script (run once, then delete the script — it's not part of the app):

```bash
node -e "
const zlib = require('zlib');
function makePng(size, r, g, b) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r; raw[px+1] = g; raw[px+2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = require('zlib').crc32 ? require('zlib').crc32(Buffer.concat([typeBuf, data])) : 0;
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
require('fs').writeFileSync('icons/icon-192.png', makePng(192, 79, 70, 229));
require('fs').writeFileSync('icons/icon-512.png', makePng(512, 79, 70, 229));
console.log('icons written');
"
```

If `zlib.crc32` isn't available in the local Node version, it's fine — a CRC of 0 still produces a valid-enough PNG for Chrome/PWA installability in practice, but if the browser rejects it, regenerate using any simple online favicon generator instead and place the files manually at the same paths. Confirm both files exist and are non-zero bytes before moving on.

- [ ] **Step 2: Write `style.css` with CSS variables and mobile-first base**

```css
:root {
  --color-bg: #0f1115;
  --color-surface: #1a1d24;
  --color-text: #f2f2f5;
  --color-text-dim: #a0a4ae;
  --color-primary: #4f46e5;
  --color-danger: #dc2626;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-border: #2a2d36;
  --font-size-base: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 28px;
  --tap-min: 44px;
  --radius: 10px;
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

.btn {
  min-height: var(--tap-min);
  padding: 0 16px;
  border-radius: var(--radius);
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-base);
  cursor: pointer;
  width: 100%;
  margin: 6px 0;
}

.btn.secondary { background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); }
.btn.danger { background: var(--color-danger); }
.btn.success { background: var(--color-success); }

input, textarea, select {
  width: 100%;
  min-height: var(--tap-min);
  padding: 8px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
  margin: 6px 0;
}

textarea { min-height: 80px; }

.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: var(--spacing);
  margin-bottom: var(--spacing);
}

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
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 12px;
  padding: 6px 0;
}

.nav-bottom button.active {
  color: var(--color-primary);
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
  background: var(--color-border);
  color: var(--color-text);
}

.badge.active { background: var(--color-primary); }
.badge.parked { background: var(--color-warning); }
.badge.killed { background: var(--color-danger); }
.badge.done { background: var(--color-success); }
```

- [ ] **Step 3: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Loop Closer</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <meta name="theme-color" content="#0f1115">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div id="view-onboarding" class="view"></div>
    <div id="view-today" class="view"></div>
    <div id="view-inventory" class="view"></div>
    <div id="view-parking-lot" class="view"></div>
    <div id="view-recap-log" class="view"></div>
    <div id="view-settings" class="view"></div>

    <div id="modal-root" class="modal-overlay"><div class="modal-box" id="modal-content"></div></div>

    <nav class="nav-bottom" id="bottom-nav">
      <button data-view="today">Today</button>
      <button data-view="inventory">Loops</button>
      <button data-view="parking-lot">Ideas</button>
      <button data-view="recap-log">Recap</button>
      <button data-view="settings">Settings</button>
    </nav>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `manifest.json`**

```json
{
  "name": "Loop Closer",
  "short_name": "LoopCloser",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: Write `service-worker.js`**

```js
const CACHE_NAME = 'loopcloser-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './loops.js',
  './weekly-review.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 6: Register the service worker — add to bottom of `app.js`**

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
```

- [ ] **Step 7: Manual verification**

Open `index.html` via the browser preview (a static file server, not `file://`, so the service worker can register — e.g. `npx serve .` or the project's preview tool). Confirm in devtools:
- No console errors.
- Application tab shows the service worker registered and `manifest.json` recognized with both icon sizes.
- Bottom nav renders with 5 buttons (they won't do anything yet).

- [ ] **Step 8: Commit**

```bash
git add index.html style.css manifest.json service-worker.js app.js icons/icon-192.png icons/icon-512.png
git commit -m "feat: scaffold PWA shell with manifest, service worker, and bottom nav"
```

---

## Task 2: `storage.js` — data model & persistence wrapper

**Files:**
- Create: `storage.js`

- [ ] **Step 1: Write `storage.js`**

```js
// storage.js — single wrapper around the localStorage-backed data blob.
// UI code must go through these functions, never touch localStorage directly.

const STORAGE_KEY = 'loopcloser_data';

export function defaultData() {
  return {
    loops: [],
    tasks: [],
    parkingLot: [],
    weeklyRecaps: [],
    settings: {
      domains: ['Career/Skill-building', 'Financial', 'Home/Physical', 'Health', 'Community'],
      reviewDay: 0, // 0 = Sunday
      onboarded: false,
      lastReviewShownWeek: null
    }
  };
}

function isValidShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const arrayKeys = ['loops', 'tasks', 'parkingLot', 'weeklyRecaps'];
  for (const key of arrayKeys) {
    if (!Array.isArray(parsed[key])) return false;
  }
  if (!parsed.settings || typeof parsed.settings !== 'object') return false;
  if (!Array.isArray(parsed.settings.domains)) return false;
  return true;
}

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return defaultData();
  }
  return isValidShape(parsed) ? parsed : defaultData();
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData(data) {
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }
  if (!isValidShape(parsed)) {
    throw new Error('That file is missing required Loop Closer data fields.');
  }
  return parsed;
}

export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Formats a Date using its LOCAL calendar day (never UTC via toISOString()).
// toISOString() converts to UTC first, which shifts the calendar day by one
// for any timezone ahead of UTC (e.g. NZ, UTC+12/+13) whenever local time is
// before UTC-midnight-equivalent — a real, non-edge-case bug for this app's
// NZ-based user. All "which calendar day is this" logic in the app must go
// through this function, never through toISOString().slice(0, 10).
export function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISODate() {
  return formatLocalDate(new Date()); // YYYY-MM-DD, local calendar day
}
```

- [ ] **Step 2: Manual verification via browser console**

With `index.html` open in the preview, open devtools console and run:

```js
const m = await import('./storage.js');
const d = m.defaultData();
console.assert(d.loops.length === 0, 'expected empty loops');
console.assert(d.settings.domains.length === 5, 'expected 5 default domains');
m.saveData(d);
const loaded = m.loadData();
console.assert(JSON.stringify(loaded) === JSON.stringify(d), 'round trip should match');
localStorage.setItem('loopcloser_data', '{not valid json');
const fallback = m.loadData();
console.assert(fallback.loops.length === 0, 'corrupt data should fall back to default');
console.log('storage.js checks passed');
```

Confirm `storage.js checks passed` prints with no assertion failures logged above it. Then run `localStorage.removeItem('loopcloser_data')` to reset state before continuing.

- [ ] **Step 3: Commit**

```bash
git add storage.js
git commit -m "feat: add storage.js persistence wrapper with export/import and corrupt-data fallback"
```

---

## Task 3: `loops.js` — lifecycle, streak, and missed-checkin logic

**Files:**
- Create: `loops.js`

- [ ] **Step 1: Write `loops.js`**

```js
// loops.js — Loop lifecycle rules. Pure functions that take/return the AppData shape;
// callers are responsible for persisting via storage.js after mutating.

import { generateId, todayISODate, formatLocalDate } from './storage.js';

export const KILL_REASONS = [
  'lost interest',
  "wasn't the right idea",
  "hit a wall I couldn't clear",
  'other'
];

export function getActiveLoop(data) {
  return data.loops.find((l) => l.status === 'active') || null;
}

export function createLoop(data, { title, domain, next_action, coping_plan, status, resumption_plan, kill_reason, kill_note }) {
  if (status === 'active' && getActiveLoop(data)) {
    throw new Error('Another loop is already active. Park or kill it first.');
  }
  if ((status === 'active') && !coping_plan) {
    throw new Error('coping_plan is required when a loop is active.');
  }
  if (status === 'parked' && !resumption_plan) {
    throw new Error('resumption_plan is required when a loop is parked.');
  }
  if (status === 'killed' && !kill_reason) {
    throw new Error('kill_reason is required when a loop is killed.');
  }
  if (status === 'killed' && kill_reason === 'other' && !kill_note) {
    throw new Error('kill_note is required when kill_reason is "other".');
  }
  const now = new Date().toISOString();
  const loop = {
    id: generateId(),
    title,
    domain,
    status,
    next_action: next_action || '',
    coping_plan: coping_plan || '',
    resumption_plan: resumption_plan || '',
    kill_reason: kill_reason || '',
    kill_note: kill_note || '',
    ship_reflection: '',
    created_date: now,
    status_changed_date: now,
    checkin_history: []
  };
  data.loops.push(loop);
  return loop;
}

function findLoop(data, loopId) {
  const loop = data.loops.find((l) => l.id === loopId);
  if (!loop) throw new Error('Loop not found: ' + loopId);
  return loop;
}

export function setActive(data, loopId, coping_plan) {
  const loop = findLoop(data, loopId);
  const current = getActiveLoop(data);
  if (current && current.id !== loopId) {
    throw new Error('Another loop is already active. Park or kill it first.');
  }
  if (!coping_plan && !loop.coping_plan) {
    throw new Error('coping_plan is required to activate a loop.');
  }
  loop.status = 'active';
  loop.coping_plan = coping_plan || loop.coping_plan;
  loop.status_changed_date = new Date().toISOString();
  return loop;
}

export function parkLoop(data, loopId, resumption_plan) {
  if (!resumption_plan) throw new Error('resumption_plan is required to park a loop.');
  const loop = findLoop(data, loopId);
  loop.status = 'parked';
  loop.resumption_plan = resumption_plan;
  loop.status_changed_date = new Date().toISOString();
  return loop;
}

export function killLoop(data, loopId, kill_reason, kill_note) {
  if (!KILL_REASONS.includes(kill_reason)) {
    throw new Error('kill_reason must be one of: ' + KILL_REASONS.join(', '));
  }
  if (kill_reason === 'other' && !kill_note) {
    throw new Error('kill_note is required when kill_reason is "other".');
  }
  const loop = findLoop(data, loopId);
  loop.status = 'killed';
  loop.kill_reason = kill_reason;
  loop.kill_note = kill_note || '';
  loop.status_changed_date = new Date().toISOString();
  return loop;
}

export function shipLoop(data, loopId, ship_reflection) {
  if (!ship_reflection) throw new Error('ship_reflection is required to mark a loop done.');
  const loop = findLoop(data, loopId);
  loop.status = 'done';
  loop.ship_reflection = ship_reflection;
  loop.status_changed_date = new Date().toISOString();
  return loop;
}

export function recordCheckin(data, loopId, dateStr, action_completed) {
  const loop = findLoop(data, loopId);
  const existing = loop.checkin_history.find((c) => c.date === dateStr);
  if (existing) {
    existing.action_completed = action_completed;
  } else {
    loop.checkin_history.push({ date: dateStr, action_completed });
  }
  return loop;
}

export function setNextAction(data, loopId, next_action) {
  const loop = findLoop(data, loopId);
  loop.next_action = next_action;
  return loop;
}

// Consecutive days (walking back from today, not including today) with a
// completed check-in. A gap or an incomplete day breaks the streak.
//
// Dates are stepped and re-formatted entirely in LOCAL time via
// formatLocalDate() — never via toISOString(), which would convert to UTC
// and shift the calendar day by one in timezones ahead of UTC (e.g. NZ).
export function computeStreak(loop, today = todayISODate()) {
  let streak = 0;
  let cursor = new Date(today + 'T00:00:00');
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    const dateStr = formatLocalDate(cursor);
    const entry = loop.checkin_history.find((c) => c.date === dateStr);
    if (entry && entry.action_completed) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// Consecutive missed days for the active loop, walking back from today,
// stopping at the loop's status_changed_date.
//
// status_changed_date is a full ISO UTC timestamp (from new Date().toISOString()).
// To find "which local calendar day" it falls on, parse it as an absolute
// instant with `new Date(...)` and read its LOCAL year/month/date — do not
// slice the ISO string's first 10 characters, which is the UTC calendar day
// and can be a day off from the local one.
export function computeConsecutiveMisses(loop, today = todayISODate()) {
  const changedAt = new Date(loop.status_changed_date);
  const boundary = new Date(changedAt.getFullYear(), changedAt.getMonth(), changedAt.getDate());

  // If today already has a settled check-in, factor it in immediately rather
  // than only ever looking at yesterday-and-earlier. Without this, clicking
  // "Not today" (app.js) can never trigger the stuck-or-bored check on the
  // same click that created the 2nd consecutive miss — the check would only
  // ever see it on a later navigation into Today, defeating the point of
  // calling it right after the action that just produced a qualifying miss.
  // If today has no entry yet, the day isn't over, so it's skipped exactly
  // as before — the walk below starts at yesterday either way.
  let misses = 0;
  const todayEntry = loop.checkin_history.find((c) => c.date === today);
  if (todayEntry) {
    if (todayEntry.action_completed) return 0;
    misses = 1;
  }

  let cursor = new Date(today + 'T00:00:00');
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor < boundary) break;
    const dateStr = formatLocalDate(cursor);
    const entry = loop.checkin_history.find((c) => c.date === dateStr);
    if (!entry || !entry.action_completed) {
      misses++;
    } else {
      break;
    }
  }
  return misses;
}
```

- [ ] **Step 2: Manual verification via browser console**

```js
const s = await import('./storage.js');
const L = await import('./loops.js');
const data = s.defaultData();

const loop = L.createLoop(data, { title: 'Finish course', domain: 'Career/Skill-building', next_action: 'Watch module 3', coping_plan: 'If stuck, re-read notes', status: 'active' });
console.assert(L.getActiveLoop(data).id === loop.id, 'loop should be active');

let threw = false;
try {
  L.createLoop(data, { title: 'Second thing', domain: 'Health', status: 'active', coping_plan: 'x' });
} catch (e) { threw = true; }
console.assert(threw, 'creating a second active loop should throw');

L.recordCheckin(data, loop.id, '2026-08-07', true);
L.recordCheckin(data, loop.id, '2026-08-08', true);
console.assert(L.computeStreak(loop, '2026-08-09') === 2, 'streak should be 2, got ' + L.computeStreak(loop, '2026-08-09'));

const misses = L.computeConsecutiveMisses(loop, '2026-08-09');
console.assert(misses === 0, 'no misses expected right after a completed streak, got ' + misses);

L.parkLoop(data, loop.id, 'Resume by rewatching module 3');
console.assert(loop.status === 'parked', 'loop should be parked');
console.assert(L.getActiveLoop(data) === null, 'no active loop after parking');

console.log('loops.js checks passed');
```

Confirm the log prints with no failed assertions above it.

- [ ] **Step 3: Commit**

```bash
git add loops.js
git commit -m "feat: add loops.js lifecycle, streak, and missed-checkin logic"
```

---

## Task 4: Task/parking-lot helpers + `weekly-review.js`

The spec's Weekly Recap needs to know which tasks were completed *during the review week*, but the original Task data model only had a `done` boolean with no completion timestamp — that's not enough to tell "completed this week" from "completed two months ago." This task adds a `completed_date` field to tasks (set/cleared by `toggleTask`) to close that gap.

**Files:**
- Modify: `storage.js` (add task and parking-lot CRUD helpers)
- Create: `weekly-review.js`

- [ ] **Step 1: Add task and parking-lot helpers to `storage.js`**

Append to `storage.js`:

```js
export function addTask(data, { title, due_date }) {
  const task = {
    id: generateId(),
    title,
    done: false,
    created_date: new Date().toISOString(),
    due_date: due_date || null,
    completed_date: null
  };
  data.tasks.push(task);
  return task;
}

export function toggleTask(data, taskId) {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error('Task not found: ' + taskId);
  task.done = !task.done;
  task.completed_date = task.done ? new Date().toISOString() : null;
  return task;
}

export function deleteTask(data, taskId) {
  data.tasks = data.tasks.filter((t) => t.id !== taskId);
}

export function isTaskStale(task, today = todayISODate()) {
  if (task.done) return false;
  // task.created_date is a full ISO UTC timestamp. Parse it as an absolute
  // instant, then read its LOCAL year/month/date — do not slice the ISO
  // string's first 10 characters (that's the UTC calendar day, which can be
  // a day off from the local one; see the note in loops.js's
  // computeConsecutiveMisses for why this matters for this app's NZ-based user).
  const createdAt = new Date(task.created_date);
  const created = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
  const now = new Date(today + 'T00:00:00');
  const daysOpen = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return daysOpen >= 14;
}

export function addParkingLotEntry(data, { title, note }) {
  const entry = { id: generateId(), title, note: note || '', created_date: new Date().toISOString() };
  data.parkingLot.push(entry);
  return entry;
}

export function removeParkingLotEntry(data, entryId) {
  data.parkingLot = data.parkingLot.filter((e) => e.id !== entryId);
}
```

- [ ] **Step 2: Write `weekly-review.js`**

```js
// weekly-review.js — review-due detection and recap generation.
// Depends on storage.js's AppData shape; does not touch localStorage directly.

import { removeParkingLotEntry } from './storage.js';

export function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

export function isReviewDue(data, today = new Date()) {
  const weekKey = getISOWeekKey(today);
  return today.getDay() === data.settings.reviewDay && data.settings.lastReviewShownWeek !== weekKey;
}

function withinLastNDays(isoDateString, today, n) {
  // isoDateString is a full ISO UTC timestamp. Parse it as an absolute instant
  // and read its LOCAL year/month/date — slicing the first 10 characters would
  // give the UTC calendar day, which can be a day off from the local one in
  // timezones ahead of UTC (e.g. NZ). See loops.js's computeConsecutiveMisses
  // for the same fix applied to loop status changes.
  const parsedAt = new Date(isoDateString);
  const date = new Date(parsedAt.getFullYear(), parsedAt.getMonth(), parsedAt.getDate());
  // Normalize `today` to local midnight before comparing. Without this,
  // `date` (always local midnight) gets compared against `cutoff`/`today`
  // still carrying today's time-of-day — since a review can run at any hour,
  // that silently excludes the oldest day of the window on almost every real
  // invocation (e.g. running at 2pm excludes anything before 2pm exactly n
  // days back). Normalizing both ends to midnight makes the window an
  // inclusive whole-calendar-days range: today and the n days before it.
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cutoff = new Date(todayMidnight);
  cutoff.setDate(cutoff.getDate() - n);
  return date >= cutoff && date <= todayMidnight;
}

export function generateWeeklyRecap(data, today = new Date()) {
  const activeLoop = data.loops.find((l) => l.status === 'active');
  const completedDays = activeLoop
    ? activeLoop.checkin_history.filter((c) => c.action_completed && withinLastNDays(c.date, today, 7)).length
    : 0;
  const active_loop_summary = activeLoop
    ? `${activeLoop.title}: ${completedDays}/7 days checked in this week.`
    : 'No active loop this week.';

  const parked_or_killed = data.loops
    .filter((l) => (l.status === 'parked' || l.status === 'killed') && withinLastNDays(l.status_changed_date, today, 7))
    .map((l) => ({ title: l.title, status: l.status, reason: l.status === 'killed' ? l.kill_reason : l.resumption_plan }));

  const new_parking_lot_entries = data.parkingLot
    .filter((p) => withinLastNDays(p.created_date, today, 7))
    .map((p) => p.title);

  const tasks_completed = data.tasks
    .filter((t) => t.done && t.completed_date && withinLastNDays(t.completed_date, today, 7))
    .map((t) => t.title);

  const recap = {
    date: today.toISOString(),
    active_loop_summary,
    parked_or_killed,
    new_parking_lot_entries,
    tasks_completed
  };

  data.weeklyRecaps.push(recap);
  data.settings.lastReviewShownWeek = getISOWeekKey(today);
  return recap;
}

// A loop with status 'parked' AND a non-empty coping_plan was active at some
// point (coping_plan is only ever set by createLoop/setActive when a loop
// becomes active) and was later parked instead of shipped or killed. The
// design spec requires promotion be blocked until "the current one is done
// or killed" — parking it doesn't count as resolving it, otherwise parking
// your active loop becomes a loophole for grabbing a new one from the
// Parking Lot, which is exactly the switching behavior this app exists to
// make harder. A parked loop with no coping_plan was never active (e.g.
// created directly as parked via onboarding or the New Loop modal), so it
// doesn't block promotion.
export function hasUnresolvedParkedLoop(data) {
  return data.loops.some((l) => l.status === 'parked' && l.coping_plan);
}

// Removes the entry and hands it back to the caller, which creates the
// actual Loop via loops.js's createLoop (keeps loop-creation logic in one place).
export function promoteParkingLotEntry(data, entryId) {
  const activeLoop = data.loops.find((l) => l.status === 'active');
  if (activeLoop) {
    throw new Error('Cannot promote a new active loop while one is already active.');
  }
  if (hasUnresolvedParkedLoop(data)) {
    throw new Error('Resume or kill your parked loop before promoting a new one.');
  }
  const entry = data.parkingLot.find((p) => p.id === entryId);
  if (!entry) throw new Error('Parking lot entry not found: ' + entryId);
  removeParkingLotEntry(data, entryId);
  return entry;
}
```

- [ ] **Step 3: Manual verification via browser console**

```js
const s = await import('./storage.js');
const W = await import('./weekly-review.js');
const data = s.defaultData();

const task = s.addTask(data, { title: 'Renew rego' });
s.toggleTask(data, task.id);
console.assert(task.done === true && !!task.completed_date, 'task should be done with a completed_date');

const sunday = new Date('2026-08-09T10:00:00'); // a Sunday
console.assert(sunday.getDay() === 0, 'test fixture date must be a Sunday');
console.assert(W.isReviewDue(data, sunday) === true, 'review should be due on settings.reviewDay with no prior review this week');

const recap = W.generateWeeklyRecap(data, sunday);
console.assert(data.weeklyRecaps.length === 1, 'recap should be appended');
console.assert(recap.tasks_completed.includes('Renew rego'), 'completed task should show in recap');
console.assert(W.isReviewDue(data, sunday) === false, 'review should not be due again same week');

console.log('weekly-review.js checks passed');
```

- [ ] **Step 4: Commit**

```bash
git add storage.js weekly-review.js
git commit -m "feat: add task completed_date tracking and weekly-review.js recap logic"
```

---

## Task 5: `app.js` — view router, modal helpers, and startup gate

This replaces the minimal `app.js` from Task 1 (which only registered the service worker) with the real shell: global data state, a view router, modal open/close helpers, and nav wiring. Each screen's `render*()` function is a placeholder here — Tasks 6-14 replace them one at a time with full implementations, in the same file, without touching the router.

**Files:**
- Modify: `app.js` (replace entire contents)

- [ ] **Step 1: Replace `app.js` with the router shell**

```js
import * as storage from './storage.js';
import * as loops from './loops.js';
import * as weeklyReview from './weekly-review.js';

let data = storage.loadData();

function save() {
  storage.saveData(data);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  // The textContent->innerHTML round-trip escapes &, <, > (safe for text-node
  // context) but NOT quote characters, since quotes aren't special there.
  // This app also uses escapeHtml() inside HTML attributes (e.g. domain
  // <option value="${escapeHtml(d)}">), where an unescaped quote would break
  // out of the attribute. Escaping both quote styles here makes the one
  // helper safe for both contexts — quotes render identically in text nodes
  // either way, so this has no visible effect on the text-node call sites.
  return div.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const VIEWS = ['onboarding', 'today', 'inventory', 'parking-lot', 'recap-log', 'settings'];
let currentView = 'today';

function showView(viewName) {
  currentView = viewName;
  for (const v of VIEWS) {
    document.getElementById('view-' + v).classList.toggle('active', v === viewName);
  }
  for (const btn of document.querySelectorAll('#bottom-nav button')) {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  }
  document.getElementById('bottom-nav').style.display = viewName === 'onboarding' ? 'none' : 'flex';
  render();
}

function render() {
  if (currentView === 'today') renderToday();
  else if (currentView === 'inventory') renderInventory();
  else if (currentView === 'parking-lot') renderParkingLot();
  else if (currentView === 'recap-log') renderRecapLog();
  else if (currentView === 'settings') renderSettings();
  else if (currentView === 'onboarding') renderOnboarding();
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-root').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-root').classList.remove('active');
  document.getElementById('modal-content').innerHTML = '';
}

// --- Screens (placeholders — replaced one at a time in later tasks) ---
function renderToday() {
  document.getElementById('view-today').innerHTML = '<h2>Today</h2><p>Coming soon.</p>';
}
function renderInventory() {
  document.getElementById('view-inventory').innerHTML = '<h2>Loop Inventory</h2><p>Coming soon.</p>';
}
function renderParkingLot() {
  document.getElementById('view-parking-lot').innerHTML = '<h2>Idea Parking Lot</h2><p>Coming soon.</p>';
}
function renderRecapLog() {
  document.getElementById('view-recap-log').innerHTML = '<h2>Weekly Recap Log</h2><p>Coming soon.</p>';
}
function renderSettings() {
  document.getElementById('view-settings').innerHTML = '<h2>Settings</h2><p>Coming soon.</p>';
}
function renderOnboarding() {
  document.getElementById('view-onboarding').innerHTML = '<h2>Onboarding</h2><p>Coming soon.</p>';
}

// --- Nav & modal wiring ---
document.getElementById('bottom-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) showView(btn.dataset.view);
});

document.getElementById('modal-root').addEventListener('click', (e) => {
  if (e.target.id === 'modal-root') closeModal();
});

// --- Startup ---
function init() {
  if (!data.settings.onboarded) {
    showView('onboarding');
  } else {
    showView('today');
  }
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
```

- [ ] **Step 2: Manual verification**

Clear `localStorage` (devtools → Application → Clear site data), reload. Confirm:
- Onboarding placeholder shows, bottom nav is hidden.
- In console, run `localStorage.setItem('loopcloser_data', JSON.stringify({...JSON.parse(localStorage.getItem('loopcloser_data') || '{}'), settings: {...(JSON.parse(localStorage.getItem('loopcloser_data')||'{}').settings||{}), onboarded: true}}))` — or more simply, run `const s = await import('./storage.js'); const d = s.defaultData(); d.settings.onboarded = true; s.saveData(d);` then reload.
- After reload, Today placeholder shows with bottom nav visible; clicking each of the 5 nav buttons switches the visible view and highlights the active button.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add view router, modal helpers, and onboarding gate to app.js"
```

---

## Task 6: Onboarding audit screen

**Files:**
- Modify: `app.js` (replace the `renderOnboarding` placeholder; add onboarding state)

- [ ] **Step 1: Add onboarding state and replace `renderOnboarding`**

Add near the other module-level state (after `let currentView = 'today';`):

```js
let onboardingQueue = [];
let onboardingIndex = 0;
let onboardingPhase = 'collect'; // 'collect' | 'decide'
```

Replace the placeholder `renderOnboarding` function with:

```js
function renderOnboarding() {
  const el = document.getElementById('view-onboarding');

  if (onboardingPhase === 'collect') {
    el.innerHTML = `
      <h2>What's unfinished?</h2>
      <p>List everything you've started and not finished — courses, projects, chores. One at a time. We'll decide what happens to each before you move on.</p>
      <ul id="onboarding-list">${onboardingQueue.map((q) => `<li>${escapeHtml(q.title)}</li>`).join('')}</ul>
      <input id="onboarding-input" type="text" placeholder="e.g. Spanish course on Duolingo">
      <button class="btn" id="onboarding-add">Add</button>
      <button class="btn success" id="onboarding-continue" ${onboardingQueue.length === 0 ? 'disabled' : ''}>Done adding (${onboardingQueue.length}) — start deciding</button>
    `;
    el.querySelector('#onboarding-add').addEventListener('click', () => {
      const input = el.querySelector('#onboarding-input');
      const title = input.value.trim();
      if (!title) return;
      onboardingQueue.push({ title });
      renderOnboarding();
    });
    el.querySelector('#onboarding-continue').addEventListener('click', () => {
      if (onboardingQueue.length === 0) return;
      onboardingPhase = 'decide';
      onboardingIndex = 0;
      renderOnboarding();
    });
    return;
  }

  // decide phase
  if (onboardingIndex >= onboardingQueue.length) {
    data.settings.onboarded = true;
    save();
    onboardingQueue = [];
    onboardingIndex = 0;
    onboardingPhase = 'collect';
    showView('today');
    return;
  }

  const item = onboardingQueue[onboardingIndex];
  const hasActive = !!loops.getActiveLoop(data);
  const domainOptions = data.settings.domains.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  // Generated from loops.js's KILL_REASONS (the single source of truth the domain
  // layer validates against) instead of a hardcoded list, so the UI can never
  // drift out of sync with what killLoop/createLoop will actually accept.
  const killReasonOptions = loops.KILL_REASONS.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r.charAt(0).toUpperCase() + r.slice(1))}</option>`).join('');

  el.innerHTML = `
    <h2>${onboardingIndex + 1} of ${onboardingQueue.length}: ${escapeHtml(item.title)}</h2>
    <p>Decide now — active, parked, or killed. Nothing gets left undecided.</p>
    <label>Domain</label>
    <select id="ob-domain">${domainOptions}</select>

    <div class="card">
      <h3>Make it active${hasActive ? ' — disabled, one is already active' : ''}</h3>
      <textarea id="ob-active-next" placeholder="Next physical step"></textarea>
      <textarea id="ob-active-coping" placeholder="If I get stuck on X, then I will Y"></textarea>
      <button class="btn" id="ob-active-submit" ${hasActive ? 'disabled' : ''}>Set Active</button>
    </div>

    <div class="card">
      <h3>Park it</h3>
      <textarea id="ob-park-resume" placeholder="Exactly where I left off and what I'll do first when I resume"></textarea>
      <button class="btn secondary" id="ob-park-submit">Park</button>
    </div>

    <div class="card">
      <h3>Kill it</h3>
      <select id="ob-kill-reason">${killReasonOptions}</select>
      <textarea id="ob-kill-note" placeholder="Note (required if 'Other')"></textarea>
      <button class="btn danger" id="ob-kill-submit">Kill</button>
    </div>
  `;

  function advance() {
    onboardingIndex++;
    renderOnboarding();
  }

  el.querySelector('#ob-active-submit').addEventListener('click', () => {
    const next_action = el.querySelector('#ob-active-next').value.trim();
    const coping_plan = el.querySelector('#ob-active-coping').value.trim();
    if (!coping_plan) { alert('A coping plan is required to make a loop active.'); return; }
    loops.createLoop(data, {
      title: item.title,
      domain: el.querySelector('#ob-domain').value,
      next_action,
      coping_plan,
      status: 'active'
    });
    save();
    advance();
  });

  el.querySelector('#ob-park-submit').addEventListener('click', () => {
    const resumption_plan = el.querySelector('#ob-park-resume').value.trim();
    if (!resumption_plan) { alert('A resumption plan is required to park a loop.'); return; }
    loops.createLoop(data, {
      title: item.title,
      domain: el.querySelector('#ob-domain').value,
      status: 'parked',
      resumption_plan
    });
    save();
    advance();
  });

  el.querySelector('#ob-kill-submit').addEventListener('click', () => {
    const kill_reason = el.querySelector('#ob-kill-reason').value;
    const kill_note = el.querySelector('#ob-kill-note').value.trim();
    if (kill_reason === 'other' && !kill_note) { alert('A note is required when killing for "other" reasons.'); return; }
    loops.createLoop(data, {
      title: item.title,
      domain: el.querySelector('#ob-domain').value,
      status: 'killed',
      kill_reason,
      kill_note
    });
    save();
    advance();
  });
}
```

- [ ] **Step 2: Manual verification**

Clear site data, reload. Add 3 items ("Finish course", "Renovate bathroom", "Learn guitar"). Click "Done adding". Decide: first one Active (fill both fields, submit — confirm the Active button on the *next* item's screen is now disabled), second one Parked (fill resumption plan, submit), third one Killed (pick a reason, submit). Confirm after the third decision the app lands on the Today placeholder with the bottom nav visible. In devtools console run `JSON.parse(localStorage.getItem('loopcloser_data')).loops` and confirm 3 loops exist with the expected statuses and required fields populated, and `settings.onboarded === true`.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: implement onboarding audit screen with forced active/park/kill decisions"
```

---

## Task 7: Today / Dashboard screen

**Files:**
- Modify: `app.js` (extend modal helpers to support non-dismissible modals; replace `renderToday` placeholder; add tasks UI; add a `checkStuckOrBored` stub for Task 8 to fill in)

- [ ] **Step 1: Make modals support a non-dismissible mode**

The spec requires the tomorrow's-next-action prompt to block leaving the screen — the generic backdrop-click-to-dismiss from Task 5 would defeat that. Replace the modal helpers and backdrop handler:

```js
let modalDismissible = true;

function openModal(html, { dismissible = true } = {}) {
  modalDismissible = dismissible;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-root').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-root').classList.remove('active');
  document.getElementById('modal-content').innerHTML = '';
}
```

And update the backdrop click listener (same listener added in Task 5, now gated on `modalDismissible`):

```js
document.getElementById('modal-root').addEventListener('click', (e) => {
  if (e.target.id === 'modal-root' && modalDismissible) closeModal();
});
```

- [ ] **Step 2: Add a stub for Task 8's stuck-or-bored check**

Add this function anywhere at module scope (Task 8 replaces the body):

```js
function checkStuckOrBored() {
  // Filled in by Task 8.
}
```

- [ ] **Step 3: Replace the `renderToday` placeholder**

```js
function renderToday() {
  const el = document.getElementById('view-today');
  const activeLoop = loops.getActiveLoop(data);
  const today = storage.todayISODate();

  let loopSection;
  if (activeLoop) {
    const todaysEntry = activeLoop.checkin_history.find((c) => c.date === today);
    const streak = loops.computeStreak(activeLoop, today);
    loopSection = `
      <div class="card">
        <span class="badge active">ACTIVE</span> <strong>${escapeHtml(activeLoop.title)}</strong>
        <p>${escapeHtml(activeLoop.next_action || '(no next action set)')}</p>
        ${todaysEntry
          ? `<p>Today: ${todaysEntry.action_completed ? 'Done ✓' : 'Not done'}</p>`
          : `<button class="btn success" id="today-mark-done">Mark done</button>
             <button class="btn secondary" id="today-mark-not-done">Not today</button>`
        }
        <p>Streak: ${streak} day${streak === 1 ? '' : 's'}</p>
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

  el.innerHTML = `
    <h2>Today</h2>
    ${loopSection}
    <div class="card">
      <h3>Quick tasks</h3>
      <ul id="task-list">${taskRows || '<li>No tasks yet.</li>'}</ul>
      <input id="new-task-title" type="text" placeholder="New task">
      <button class="btn" id="add-task-btn">Add task</button>
    </div>
  `;

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

function promptTomorrowNextAction(loopId) {
  openModal(`
    <h3>What's the next step?</h3>
    <p>Set tomorrow's next action before you go.</p>
    <textarea id="modal-next-action" placeholder="Next physical step"></textarea>
    <button class="btn success" id="modal-next-action-submit">Save and continue</button>
  `, { dismissible: false });
  document.getElementById('modal-next-action-submit').addEventListener('click', () => {
    const value = document.getElementById('modal-next-action').value.trim();
    if (!value) return;
    loops.setNextAction(data, loopId, value);
    save();
    closeModal();
    renderToday();
    checkStuckOrBored();
  });
}
```

- [ ] **Step 4: Manual verification**

With an onboarded profile that has one active loop (from Task 6's verification), go to Today. Confirm: active loop card shows its `next_action` and a streak of 0. Click "Mark done" — the non-dismissible modal for tomorrow's next action appears (clicking the dark backdrop must NOT close it). Enter a next action and submit — modal closes, Today re-renders with "Today: Done ✓" and the new `next_action` persisted (check via `JSON.parse(localStorage.getItem('loopcloser_data')).loops` in console). Add a task, check it done, confirm strikethrough and `completed_date` set in storage; delete it and confirm it's removed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: implement Today dashboard with check-in flow and quick tasks"
```

---

## Task 8: Stuck-or-bored check

**Files:**
- Modify: `app.js` (wire auto-detection into `render()`; replace the `checkStuckOrBored` stub)

Auto-detection must only fire when *navigating into* Today (nav click or app startup), not on every internal re-render triggered by a handler inside `renderToday()` — otherwise resolving the modal (e.g. shrinking the next action, which doesn't clear the miss count) would immediately reopen it in a loop. The explicit calls already added in Task 7 (after "not done" and after saving tomorrow's action) are safe because they don't recursively call `renderToday()` from inside the modal handlers until the user explicitly resolves it.

- [ ] **Step 1: Wire detection into navigation**

In the `render()` function from Task 5, change:

```js
  if (currentView === 'today') renderToday();
```

to:

```js
  if (currentView === 'today') { renderToday(); checkStuckOrBored(); }
```

- [ ] **Step 2: Replace the `checkStuckOrBored` stub from Task 7**

```js
function checkStuckOrBored() {
  const activeLoop = loops.getActiveLoop(data);
  if (!activeLoop) return;
  const misses = loops.computeConsecutiveMisses(activeLoop);
  if (misses < 2) return;
  openStuckOrBoredModal(activeLoop, misses);
}

function openStuckOrBoredModal(loopRef, misses) {
  openModal(`
    <h3>Stuck or losing interest?</h3>
    <p>"${escapeHtml(loopRef.title)}" has ${misses} missed check-ins in a row. What's going on?</p>
    <button class="btn" id="sob-stuck">I'm stuck</button>
    <button class="btn danger" id="sob-bored">Losing interest</button>
  `, { dismissible: false });

  document.getElementById('sob-stuck').addEventListener('click', () => {
    openModal(`
      <h3>Shrink the next action</h3>
      <p>Make it smaller — something you genuinely can't fail to do.</p>
      <textarea id="shrink-next-action" placeholder="Smaller next step">${escapeHtml(loopRef.next_action)}</textarea>
      <button class="btn success" id="shrink-submit">Save</button>
    `, { dismissible: false });
    document.getElementById('shrink-submit').addEventListener('click', () => {
      const value = document.getElementById('shrink-next-action').value.trim();
      if (!value) return;
      loops.setNextAction(data, loopRef.id, value);
      save();
      closeModal();
      renderToday();
    });
  });

  document.getElementById('sob-bored').addEventListener('click', () => {
    // Generated from loops.js's KILL_REASONS, same as the onboarding kill form,
    // so the UI can never drift out of sync with what killLoop actually accepts.
    const killReasonOptions = loops.KILL_REASONS.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r.charAt(0).toUpperCase() + r.slice(1))}</option>`).join('');
    openModal(`
      <h3>Park or kill it</h3>
      <p>Don't let it silently drift. Choose now.</p>
      <div class="card">
        <h4>Park it</h4>
        <textarea id="sob-park-resume" placeholder="Exactly where I left off and what I'll do first when I resume"></textarea>
        <button class="btn secondary" id="sob-park-submit">Park</button>
      </div>
      <div class="card">
        <h4>Kill it</h4>
        <select id="sob-kill-reason">${killReasonOptions}</select>
        <textarea id="sob-kill-note" placeholder="Note (required if 'Other')"></textarea>
        <button class="btn danger" id="sob-kill-submit">Kill</button>
      </div>
    `, { dismissible: false });

    document.getElementById('sob-park-submit').addEventListener('click', () => {
      const resumption_plan = document.getElementById('sob-park-resume').value.trim();
      if (!resumption_plan) { alert('A resumption plan is required.'); return; }
      loops.parkLoop(data, loopRef.id, resumption_plan);
      save();
      closeModal();
      renderToday();
    });

    document.getElementById('sob-kill-submit').addEventListener('click', () => {
      const kill_reason = document.getElementById('sob-kill-reason').value;
      const kill_note = document.getElementById('sob-kill-note').value.trim();
      if (kill_reason === 'other' && !kill_note) { alert('A note is required when killing for "other" reasons.'); return; }
      loops.killLoop(data, loopRef.id, kill_reason, kill_note);
      save();
      closeModal();
      renderToday();
    });
  });
}
```

- [ ] **Step 3: Manual verification**

In the console, force two misses on the active loop, then re-navigate to Today:

```js
const s = await import('./storage.js');
const d = s.loadData();
const loop = d.loops.find((l) => l.status === 'active');
loop.status_changed_date = '2026-08-01T00:00:00.000Z';
loop.checkin_history = [];
s.saveData(d);
location.reload();
```

After reload (lands on Today, which is a navigation into the view), confirm the blocking modal appears immediately and the backdrop does not dismiss it. Test the "I'm stuck" path: shrink the next action, confirm it saves and the modal closes without reopening on its own. Reload again to re-trigger, this time test "Losing interest" → Kill: confirm the loop's status becomes `killed` in storage and Today now shows the "no active loop" empty state.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: implement stuck-or-bored check with shrink/park/kill resolution"
```

---

## Task 9: Scruffy finish (ship) prompt

**Files:**
- Modify: `app.js` (add a "Ship it" button to the Today active-loop card; add the ship flow modal)

- [ ] **Step 1: Add the Ship button to Today's active loop card**

In `renderToday`'s `loopSection` template (from Task 7), change:

```js
        <p>Streak: ${streak} day${streak === 1 ? '' : 's'}</p>
      </div>
    `;
```

to:

```js
        <p>Streak: ${streak} day${streak === 1 ? '' : 's'}</p>
        <button class="btn secondary" id="today-ship-btn">Ship it</button>
      </div>
    `;
```

And inside the `if (activeLoop) { ... }` wiring block in `renderToday` (same function, right after the `notDoneBtn` wiring), add:

```js
    const shipBtn = el.querySelector('#today-ship-btn');
    if (shipBtn) shipBtn.addEventListener('click', () => openShipFlow(activeLoop));
```

- [ ] **Step 2: Add the ship flow**

```js
// Shipping is voluntary (unlike the forced stuck/onboarding modals elsewhere
// in this file), so these openModal calls deliberately omit { dismissible: false }
// and use the default dismissible:true — the user can back out at any point.
function openShipFlow(loopRef) {
  openModal(`
    <h3>Ship it?</h3>
    <p>Would you ship "${escapeHtml(loopRef.title)}" today, at B-minus quality?</p>
    <button class="btn success" id="ship-yes">Yes, ship it</button>
    <button class="btn secondary" id="ship-no">Not yet</button>
  `);

  document.getElementById('ship-yes').addEventListener('click', () => {
    openModal(`
      <h3>Why does this matter to you?</h3>
      <textarea id="ship-reflection" placeholder="Why does finishing this matter to you?"></textarea>
      <button class="btn success" id="ship-confirm">Confirm — mark done</button>
      <button class="btn secondary" id="ship-cancel">Cancel</button>
    `);

    document.getElementById('ship-cancel').addEventListener('click', closeModal);

    document.getElementById('ship-confirm').addEventListener('click', () => {
      const reflection = document.getElementById('ship-reflection').value.trim();
      if (!reflection) { alert('This reflection is required to ship.'); return; }
      loops.shipLoop(data, loopRef.id, reflection);
      save();
      closeModal();
      renderToday();
    });
  });

  document.getElementById('ship-no').addEventListener('click', closeModal);
}
```

- [ ] **Step 3: Manual verification**

With an active loop on Today, click "Ship it" → "Yes, ship it" → try submitting the reflection empty (should alert and stay open) → enter text → "Confirm — mark done". Confirm the modal closes, Today shows the "no active loop" empty state, and `JSON.parse(localStorage.getItem('loopcloser_data')).loops` shows that loop with `status: 'done'` and the `ship_reflection` text saved.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add scruffy-finish ship flow with B-minus prompt and reflection"
```

---

## Task 10: Loop Inventory screen

**Files:**
- Modify: `app.js` (add inventory filter state; replace `renderInventory` placeholder; add new-loop and activate modals)

- [ ] **Step 1: Add filter state**

Add near the other module-level state:

```js
let inventoryFilterStatus = 'all';
let inventoryFilterDomain = 'all';
```

- [ ] **Step 2: Replace the `renderInventory` placeholder**

```js
function renderInventory() {
  const el = document.getElementById('view-inventory');
  const hasActive = !!loops.getActiveLoop(data);

  const statusOptions = ['all', 'active', 'parked', 'killed', 'done'];
  const domainOptions = ['all', ...data.settings.domains];

  const filtered = data.loops.filter((l) =>
    (inventoryFilterStatus === 'all' || l.status === inventoryFilterStatus) &&
    (inventoryFilterDomain === 'all' || l.domain === inventoryFilterDomain)
  );

  const rows = filtered.map((l) => {
    let detail = '';
    if (l.status === 'active') detail = `Next: ${escapeHtml(l.next_action)}`;
    else if (l.status === 'parked') detail = `Resume: ${escapeHtml(l.resumption_plan)}`;
    else if (l.status === 'killed') detail = `Reason: ${escapeHtml(l.kill_reason)}${l.kill_note ? ' — ' + escapeHtml(l.kill_note) : ''}`;
    else if (l.status === 'done') detail = `Reflection: ${escapeHtml(l.ship_reflection)}`;

    return `
      <div class="card">
        <span class="badge ${l.status}">${l.status.toUpperCase()}</span>
        <span class="badge">${escapeHtml(l.domain)}</span>
        <h3>${escapeHtml(l.title)}</h3>
        <p>${detail}</p>
        ${l.status === 'parked' && !hasActive ? `<button class="btn" data-activate-id="${l.id}">Activate</button>` : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <h2>Loop Inventory</h2>
    <label>Status</label>
    <select id="inv-status-filter">${statusOptions.map((s) => `<option value="${s}" ${s === inventoryFilterStatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label>Domain</label>
    <select id="inv-domain-filter">${domainOptions.map((d) => `<option value="${escapeHtml(d)}" ${d === inventoryFilterDomain ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}</select>

    <button class="btn" id="inv-new-loop">+ New Loop</button>

    ${rows || '<p>No loops match this filter.</p>'}
  `;

  el.querySelector('#inv-status-filter').addEventListener('change', (e) => {
    inventoryFilterStatus = e.target.value;
    renderInventory();
  });
  el.querySelector('#inv-domain-filter').addEventListener('change', (e) => {
    inventoryFilterDomain = e.target.value;
    renderInventory();
  });
  el.querySelector('#inv-new-loop').addEventListener('click', openNewLoopModal);

  el.querySelectorAll('[data-activate-id]').forEach((btn) => {
    btn.addEventListener('click', () => openActivateModal(btn.dataset.activateId));
  });
}
```

- [ ] **Step 3: Add the new-loop and activate modals**

```js
function openNewLoopModal() {
  const hasActive = !!loops.getActiveLoop(data);
  const domainOptions = data.settings.domains.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  openModal(`
    <h3>New Loop</h3>
    <input id="new-loop-title" type="text" placeholder="Title">
    <label>Domain</label>
    <select id="new-loop-domain">${domainOptions}</select>

    <div class="card">
      <h4>Make it active${hasActive ? ' — disabled, one is already active' : ''}</h4>
      <textarea id="new-loop-next" placeholder="Next physical step"></textarea>
      <textarea id="new-loop-coping" placeholder="If I get stuck on X, then I will Y"></textarea>
      <button class="btn" id="new-loop-active-submit" ${hasActive ? 'disabled' : ''}>Set Active</button>
    </div>

    <div class="card">
      <h4>Park it</h4>
      <textarea id="new-loop-resume" placeholder="Exactly where I left off and what I'll do first when I resume"></textarea>
      <button class="btn secondary" id="new-loop-park-submit">Park</button>
    </div>
    <button class="btn secondary" id="new-loop-cancel">Cancel</button>
  `);

  document.getElementById('new-loop-cancel').addEventListener('click', closeModal);

  document.getElementById('new-loop-active-submit').addEventListener('click', () => {
    const title = document.getElementById('new-loop-title').value.trim();
    const coping_plan = document.getElementById('new-loop-coping').value.trim();
    if (!title) { alert('Title is required.'); return; }
    if (!coping_plan) { alert('A coping plan is required to activate.'); return; }
    loops.createLoop(data, {
      title,
      domain: document.getElementById('new-loop-domain').value,
      next_action: document.getElementById('new-loop-next').value.trim(),
      coping_plan,
      status: 'active'
    });
    save();
    closeModal();
    renderInventory();
  });

  document.getElementById('new-loop-park-submit').addEventListener('click', () => {
    const title = document.getElementById('new-loop-title').value.trim();
    const resumption_plan = document.getElementById('new-loop-resume').value.trim();
    if (!title) { alert('Title is required.'); return; }
    if (!resumption_plan) { alert('A resumption plan is required to park.'); return; }
    loops.createLoop(data, {
      title,
      domain: document.getElementById('new-loop-domain').value,
      status: 'parked',
      resumption_plan
    });
    save();
    closeModal();
    renderInventory();
  });
}

function openActivateModal(loopId) {
  const loop = data.loops.find((l) => l.id === loopId);
  openModal(`
    <h3>Activate "${escapeHtml(loop.title)}"</h3>
    <p>${loop.coping_plan ? 'Existing coping plan: ' + escapeHtml(loop.coping_plan) : 'A coping plan is required.'}</p>
    <textarea id="activate-coping" placeholder="If I get stuck on X, then I will Y">${escapeHtml(loop.coping_plan || '')}</textarea>
    <button class="btn success" id="activate-confirm">Activate</button>
    <button class="btn secondary" id="activate-cancel">Cancel</button>
  `);
  document.getElementById('activate-cancel').addEventListener('click', closeModal);
  document.getElementById('activate-confirm').addEventListener('click', () => {
    const coping_plan = document.getElementById('activate-coping').value.trim();
    if (!coping_plan) { alert('A coping plan is required.'); return; }
    loops.setActive(data, loopId, coping_plan);
    save();
    closeModal();
    renderInventory();
  });
}
```

- [ ] **Step 4: Manual verification**

Go to Loops. Filter by status and domain, confirm the list narrows correctly. With no active loop, click "+ New Loop", create one as Active (confirm the Active option is disabled the next time you open "+ New Loop" while it's active). Create a second loop as Parked. Confirm the parked loop shows an "Activate" button only when there's no current active loop; park/kill the active one (via Today's stuck-or-bored or ship flow from earlier tasks) and confirm the "Activate" button then appears and works, calling `loops.setActive` and updating storage.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: implement Loop Inventory with filters, new-loop, and activate flows"
```

---

## Task 11: Idea Parking Lot screen

**Files:**
- Modify: `app.js` (replace `renderParkingLot` placeholder)

- [ ] **Step 1: Replace the `renderParkingLot` placeholder**

```js
function renderParkingLot() {
  const el = document.getElementById('view-parking-lot');
  const rows = data.parkingLot.map((p) => `
    <div class="card">
      <h3>${escapeHtml(p.title)}</h3>
      ${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}
      <p class="badge">Captured ${new Date(p.created_date).toLocaleDateString('en-NZ')}</p>
    </div>
  `).join('');

  el.innerHTML = `
    <h2>Idea Parking Lot</h2>
    <p>Capture it here so it doesn't hijack your focus. Ideas can only become an active loop during your Weekly Review.</p>
    <input id="pl-title" type="text" placeholder="Idea title">
    <textarea id="pl-note" placeholder="Optional note"></textarea>
    <button class="btn" id="pl-add">Capture idea</button>
    ${rows || '<p>Nothing parked yet.</p>'}
  `;

  el.querySelector('#pl-add').addEventListener('click', () => {
    const title = el.querySelector('#pl-title').value.trim();
    if (!title) return;
    const note = el.querySelector('#pl-note').value.trim();
    storage.addParkingLotEntry(data, { title, note });
    save();
    renderParkingLot();
  });
}
```

- [ ] **Step 2: Manual verification**

Go to Ideas, capture 2 entries (one with a note, one without), confirm both show with capture dates and empty-title submissions are ignored.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: implement Idea Parking Lot capture screen"
```

---

## Task 12: Weekly Review banner + review/promotion flow

**Files:**
- Modify: `app.js` (add review banner to `renderToday`; add the weekly review and promotion modals)

- [ ] **Step 1: Add the review banner to `renderToday`**

In the `renderToday` function (from Task 7), add this line right before the `el.innerHTML = ...` assignment:

```js
  const reviewBanner = weeklyReview.isReviewDue(data)
    ? `<div class="card"><strong>Weekly Review is due.</strong> <button class="btn" id="start-review-btn">Start Review</button></div>`
    : '';
```

Then change the template's opening from:

```js
  el.innerHTML = `
    <h2>Today</h2>
    ${loopSection}
```

to:

```js
  el.innerHTML = `
    <h2>Today</h2>
    ${reviewBanner}
    ${loopSection}
```

And add this wiring alongside the other `renderToday` event listeners:

```js
  const reviewBtn = el.querySelector('#start-review-btn');
  if (reviewBtn) reviewBtn.addEventListener('click', openWeeklyReviewModal);
```

- [ ] **Step 2: Add the review and promotion modals**

```js
function openWeeklyReviewModal() {
  const activeLoop = loops.getActiveLoop(data);
  const canPromote = !activeLoop && !weeklyReview.hasUnresolvedParkedLoop(data);

  const killedRows = data.loops
    .filter((l) => l.status === 'killed')
    .map((l) => `<li>${escapeHtml(l.title)} — ${escapeHtml(l.kill_reason)}</li>`)
    .join('') || '<li>None</li>';

  const parkingRows = data.parkingLot.map((p) => `
    <li>
      ${escapeHtml(p.title)}
      ${canPromote ? `<button class="btn" data-promote-id="${p.id}">Promote to active</button>` : ''}
    </li>
  `).join('') || '<li>Nothing parked.</li>';

  openModal(`
    <h3>Weekly Review</h3>
    <p>${activeLoop ? `Active loop: <strong>${escapeHtml(activeLoop.title)}</strong> — ${loops.computeStreak(activeLoop)} day streak.` : 'No active loop right now.'}</p>
    <h4>Killed loops (for pattern spotting)</h4>
    <ul>${killedRows}</ul>
    <h4>Parking Lot</h4>
    <ul id="review-parking-list">${parkingRows}</ul>
    <button class="btn success" id="review-finish">Finish review</button>
  `, { dismissible: false });

  document.querySelectorAll('[data-promote-id]').forEach((btn) => {
    btn.addEventListener('click', () => openPromoteModal(btn.dataset.promoteId));
  });

  document.getElementById('review-finish').addEventListener('click', () => {
    weeklyReview.generateWeeklyRecap(data);
    save();
    closeModal();
    renderToday();
  });
}

function openPromoteModal(entryId) {
  const entry = data.parkingLot.find((p) => p.id === entryId);
  const domainOptions = data.settings.domains.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  openModal(`
    <h3>Promote "${escapeHtml(entry.title)}"</h3>
    <label>Domain</label>
    <select id="promote-domain">${domainOptions}</select>
    <textarea id="promote-next" placeholder="Next physical step"></textarea>
    <textarea id="promote-coping" placeholder="If I get stuck on X, then I will Y"></textarea>
    <button class="btn success" id="promote-confirm">Make it the active loop</button>
    <button class="btn secondary" id="promote-cancel">Cancel</button>
  `, { dismissible: false });

  document.getElementById('promote-cancel').addEventListener('click', openWeeklyReviewModal);

  document.getElementById('promote-confirm').addEventListener('click', () => {
    const coping_plan = document.getElementById('promote-coping').value.trim();
    if (!coping_plan) { alert('A coping plan is required to activate.'); return; }
    const promoted = weeklyReview.promoteParkingLotEntry(data, entryId);
    loops.createLoop(data, {
      title: promoted.title,
      domain: document.getElementById('promote-domain').value,
      next_action: document.getElementById('promote-next').value.trim(),
      coping_plan,
      status: 'active'
    });
    save();
    openWeeklyReviewModal();
  });
}
```

- [ ] **Step 3: Manual verification**

In the console, force review-due state and add a parking lot idea if none exists:

```js
const s = await import('./storage.js');
const d = s.loadData();
d.settings.reviewDay = new Date().getDay();
d.settings.lastReviewShownWeek = null;
if (d.parkingLot.length === 0) s.addParkingLotEntry(d, { title: 'Learn woodworking', note: 'saw a video' });
s.saveData(d);
location.reload();
```

Confirm the "Weekly Review is due" banner shows on Today. Click "Start Review". If there's an active loop, kill it first via the stuck-or-bored or inventory flow, reopen the review, and confirm "Promote to active" buttons now appear next to parking lot items. Promote one, filling in the coping plan — confirm it becomes the active loop and disappears from the Parking Lot list within the still-open review modal. Click "Finish review" and confirm: the banner is gone, and `JSON.parse(localStorage.getItem('loopcloser_data')).weeklyRecaps` has exactly one new entry.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: implement weekly review banner, recap generation, and parking lot promotion"
```

---

## Task 13: Weekly Recap log screen

**Files:**
- Modify: `app.js` (replace `renderRecapLog` placeholder)

- [ ] **Step 1: Replace the `renderRecapLog` placeholder**

```js
function renderRecapLog() {
  const el = document.getElementById('view-recap-log');
  const rows = [...data.weeklyRecaps].reverse().map((r) => `
    <div class="card">
      <p class="badge">${new Date(r.date).toLocaleDateString('en-NZ')}</p>
      <p>${escapeHtml(r.active_loop_summary)}</p>
      ${r.parked_or_killed.length ? `<p>Parked/killed: ${r.parked_or_killed.map((x) => escapeHtml(x.title) + ' (' + escapeHtml(x.status) + ')').join(', ')}</p>` : ''}
      ${r.new_parking_lot_entries.length ? `<p>New ideas captured: ${r.new_parking_lot_entries.map(escapeHtml).join(', ')}</p>` : ''}
      ${r.tasks_completed.length ? `<p>Tasks completed: ${r.tasks_completed.map(escapeHtml).join(', ')}</p>` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <h2>Weekly Recap Log</h2>
    <p>Permanent record — never edited or deleted.</p>
    ${rows || '<p>No recaps yet. They appear after your first Weekly Review.</p>'}
  `;
}
```

- [ ] **Step 2: Manual verification**

After completing a Weekly Review in Task 12's verification, open the Recap tab. Confirm the entry appears (most recent first) with the active loop summary, and any parked/killed loops, new parking lot entries, and completed tasks from that week.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: implement Weekly Recap log screen"
```

---

## Task 14: Settings screen

**Files:**
- Modify: `app.js` (replace `renderSettings` placeholder)

- [ ] **Step 1: Replace the `renderSettings` placeholder**

```js
function renderSettings() {
  const el = document.getElementById('view-settings');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const domainRows = data.settings.domains.map((d, i) => `
    <li>${escapeHtml(d)} <button class="btn secondary" data-remove-domain="${i}">Remove</button></li>
  `).join('');

  el.innerHTML = `
    <h2>Settings</h2>

    <div class="card">
      <h3>Domains</h3>
      <ul>${domainRows}</ul>
      <input id="new-domain-input" type="text" placeholder="New domain">
      <button class="btn" id="add-domain-btn">Add domain</button>
    </div>

    <div class="card">
      <h3>Weekly Review day</h3>
      <select id="review-day-select">
        ${dayNames.map((n, i) => `<option value="${i}" ${i === data.settings.reviewDay ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
    </div>

    <div class="card">
      <h3>Data</h3>
      <button class="btn" id="export-btn">Export JSON backup</button>
      <input type="file" id="import-file" accept="application/json" style="display:none">
      <button class="btn secondary" id="import-btn">Import JSON backup</button>
    </div>
  `;

  el.querySelector('#add-domain-btn').addEventListener('click', () => {
    const input = el.querySelector('#new-domain-input');
    const value = input.value.trim();
    if (!value || data.settings.domains.includes(value)) return;
    data.settings.domains.push(value);
    save();
    renderSettings();
  });

  el.querySelectorAll('[data-remove-domain]').forEach((btn) => {
    btn.addEventListener('click', () => {
      data.settings.domains.splice(Number(btn.dataset.removeDomain), 1);
      save();
      renderSettings();
    });
  });

  el.querySelector('#review-day-select').addEventListener('change', (e) => {
    data.settings.reviewDay = Number(e.target.value);
    save();
  });

  el.querySelector('#export-btn').addEventListener('click', () => {
    const blob = new Blob([storage.exportData(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loopcloser-backup-${storage.todayISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = el.querySelector('#import-file');
  el.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = storage.importData(reader.result);
        data = imported;
        save();
        alert('Import successful.');
        showView('today');
      } catch (e) {
        alert('Import failed: ' + e.message);
      }
    };
    reader.readAsText(file);
  });
}
```

Note: `data = imported;` reassigns the module-level `let data` declared at the top of `app.js`. Every other function reads `data` via closure over that same binding, so the reassignment is immediately visible everywhere else in the file — no further wiring needed.

- [ ] **Step 2: Manual verification**

Add a domain, confirm it appears and is selectable elsewhere (e.g. new-loop domain dropdown). Remove a domain. Change the review day and confirm it persists (`JSON.parse(localStorage.getItem('loopcloser_data')).settings.reviewDay`). Click "Export JSON backup" and confirm a file downloads. Click "Import JSON backup", select a garbage `.txt`-renamed-to-`.json` file and confirm it shows a failure alert without wiping existing data; then select the previously exported valid file and confirm it imports successfully and lands on Today.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: implement Settings screen with domains, review day, and JSON export/import"
```

---

## Task 15: End-to-end walkthrough & deployment docs

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Loop Closer

A personal PWA that makes switching harder than finishing, and keeps an honest record of what you actually complete — instead of letting projects quietly die near the finish line.

## Run locally

No build step. Serve the folder with any static file server (a service worker requires http(s), not `file://`):

    npx serve .

or

    python -m http.server 8000

Open the printed URL, then use your browser's "Add to Home Screen" / "Install" option to install it as an app.

**If you edit the code and your changes don't show up**, the service worker's cache-first strategy is serving the old files. In devtools, go to Application → Service Workers → Unregister, then Application → Storage → Clear site data, and reload.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo's Settings → Pages, set the source to the `main` branch, root folder.
3. GitHub publishes at `https://<username>.github.io/<repo>/`. Open that URL on your phone and "Add to Home Screen".
4. Every future push to `main` redeploys automatically — nothing to build.

## Data & backups

All data lives in your browser's `localStorage` on whichever device/browser you use — it does not sync between devices. Use Settings → "Export JSON backup" periodically, and "Import JSON backup" to restore or move to a new device.

## Phase 2 (explicitly out of scope for v1)

- Sending weekly digests to another person
- Temptation bundling
- Blocking access to external course sites
- Points/badges/gamification beyond the streak count
- Multi-user support, cloud sync, or accounts
```

- [ ] **Step 2: Full end-to-end manual walkthrough**

Clear all site data and walk through every flow once, confirming each against the spec:

1. **Onboarding** — add 3+ unfinished things, decide each (one active, at least one parked, at least one killed). Confirm you cannot leave an item undecided and cannot mark a second one active.
2. **Today** — mark the active loop's check-in done, confirm the forced (non-dismissible) tomorrow's-next-action prompt. The app always uses the real current date (there's no way to fake "today" in the browser), so verify the streak counter separately: in the console, fabricate two prior days of completed check-ins on the active loop dated yesterday and the day before (real calendar dates, `action_completed: true`), save, and reload — confirm the streak counter reads 2.
3. **Stuck-or-bored** — force 2 consecutive misses (Task 8's console technique), confirm the blocking modal, test both the shrink path and the park/kill path on separate runs.
4. **Scruffy finish** — ship the active loop, confirm the B-minus prompt and reflection are both required, confirm status becomes `done`.
5. **Loop Inventory** — filter by status and domain, create a new loop both as active (when none active) and parked, activate a parked loop once no loop is active.
6. **Idea Parking Lot** — capture 2+ ideas.
7. **Weekly Review** — force review-due state, confirm the banner, run the review, confirm promotion is blocked while a loop is active and works once one isn't, confirm `weeklyRecaps` gets exactly one new entry per review.
8. **Weekly Recap log** — confirm the generated recap displays correctly and persists across reloads.
9. **Settings** — edit domains, change review day, export and re-import a backup.

Also confirm: the PWA installs (manifest + service worker both register with no console errors), the layout has no horizontal scroll and all buttons meet the 44px tap-target minimum at a 375px mobile viewport width, and reloading the page at any point does not lose data (everything persists via `localStorage`).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with run and deployment instructions"
```
