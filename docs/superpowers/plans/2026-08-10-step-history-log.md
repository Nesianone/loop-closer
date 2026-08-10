# Step History Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Loop a persistent, append-only log of every step it's ever had as its `next_action`, and show that trail on the Loop Inventory screen.

**Architecture:** Add an `action_log` array field to the Loop data shape, appended to by the two existing functions that already set `next_action` (`createLoop`, `setNextAction`) in `loops.js`. Display it on Loop Inventory as a collapsed-by-default, tap-to-expand list per loop card, using the same full-re-render pattern already used throughout `app.js`.

**Tech Stack:** Same as the base app — plain HTML/CSS/vanilla JS, no build step, no new dependencies.

---

## Task 1: `loops.js` — add and populate `action_log`

**Files:**
- Modify: `loops.js:32-69` (`createLoop`)
- Modify: `loops.js:139-143` (`setNextAction`)

- [ ] **Step 1: Add `action_log` to the loop object `createLoop` constructs**

In `loops.js`, find `createLoop` (currently lines 32-69). Change:

```js
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
```

to:

```js
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
    checkin_history: [],
    action_log: next_action ? [{ date: todayISODate(), text: next_action }] : []
  };
  data.loops.push(loop);
  return loop;
}
```

(`todayISODate` is already imported at the top of `loops.js` — no new import needed.)

- [ ] **Step 2: Append to `action_log` in `setNextAction`**

Change:

```js
export function setNextAction(data, loopId, next_action) {
  const loop = findLoop(data, loopId);
  loop.next_action = next_action;
  return loop;
}
```

to:

```js
export function setNextAction(data, loopId, next_action) {
  const loop = findLoop(data, loopId);
  loop.next_action = next_action;
  if (next_action) {
    // Loops created before this field existed won't have it in their stored
    // data (loaded fresh from localStorage) — guard so this doesn't throw.
    if (!loop.action_log) loop.action_log = [];
    loop.action_log.push({ date: todayISODate(), text: next_action });
  }
  return loop;
}
```

- [ ] **Step 3: Manual verification via browser console**

With `index.html` open via a local static server, open devtools console and run:

```js
const s = await import('./storage.js');
const L = await import('./loops.js');
const data = s.defaultData();

const loop = L.createLoop(data, { title: 'Renovate toilet', domain: 'Home/Physical', next_action: 'Fill holes in wall', coping_plan: 'If stuck, ask a friend', status: 'active' });
console.assert(loop.action_log.length === 1, 'expected 1 log entry after creation, got ' + loop.action_log.length);
console.assert(loop.action_log[0].text === 'Fill holes in wall', 'first log entry text should match next_action');

L.setNextAction(data, loop.id, 'Add panels');
L.setNextAction(data, loop.id, 'Paint panels');
console.assert(loop.action_log.length === 3, 'expected 3 log entries after 2 more setNextAction calls, got ' + loop.action_log.length);
console.assert(loop.action_log[2].text === 'Paint panels', 'most recent entry should be the last setNextAction call');
console.assert(loop.next_action === 'Paint panels', 'next_action should reflect the latest call');

// Backward-compatibility check: a loop loaded from storage before this feature existed
// won't have action_log in its stored data at all. setNextAction has no status
// restriction, so this can be tested directly on a parked loop with no need to
// activate it first (which would conflict with the already-active loop above).
const legacyLoop = L.createLoop(data, { title: 'Old loop', domain: 'Health', status: 'parked', resumption_plan: 'y' });
delete legacyLoop.action_log; // simulate pre-existing stored data missing the field
L.setNextAction(data, legacyLoop.id, 'A new step');
console.assert(Array.isArray(legacyLoop.action_log) && legacyLoop.action_log.length === 1, 'setNextAction should recover from a missing action_log field, got ' + JSON.stringify(legacyLoop.action_log));

console.log('action_log checks passed');
```

Confirm `action_log checks passed` prints with no assertion failures logged above it.

- [ ] **Step 4: Commit**

```bash
git add loops.js
git commit -m "feat: add action_log to record every step a loop's next_action has ever held"
```

---

## Task 2: Loop Inventory — show the step history

**Files:**
- Modify: `app.js` (add expand/collapse state; extend `renderInventory`)

- [ ] **Step 1: Add expand/collapse state**

In `app.js`, find where `inventoryFilterStatus`/`inventoryFilterDomain` are declared (module-level state, near the top of the file). Add alongside them:

```js
let inventoryExpandedSteps = new Set();
```

- [ ] **Step 2: Add the steps toggle to each loop card in `renderInventory`**

Find the `rows` computation inside `renderInventory` (currently):

```js
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
        ${l.status === 'parked' && !hasActive && !loops.hasUnresolvedParkedLoop(data, l.id) ? `<button class="btn" data-activate-id="${l.id}">Activate</button>` : ''}
      </div>
    `;
  }).join('');
```

Replace it with:

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

- [ ] **Step 3: Wire up the toggle button**

Find the existing wiring block at the end of `renderInventory`:

```js
  el.querySelectorAll('[data-activate-id]').forEach((btn) => {
    btn.addEventListener('click', () => openActivateModal(btn.dataset.activateId));
  });
}
```

Add this right before the closing `}`:

```js
  el.querySelectorAll('[data-activate-id]').forEach((btn) => {
    btn.addEventListener('click', () => openActivateModal(btn.dataset.activateId));
  });

  el.querySelectorAll('[data-toggle-steps]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleSteps;
      if (inventoryExpandedSteps.has(id)) {
        inventoryExpandedSteps.delete(id);
      } else {
        inventoryExpandedSteps.add(id);
      }
      renderInventory();
    });
  });
}
```

- [ ] **Step 4: Manual verification**

Clear site data, onboard, and make one loop active with a next action (e.g. "Fill holes in wall"). Go to Today, mark it done, and when prompted for tomorrow's action enter "Add panels." Repeat once more entering "Paint panels." Go to Loop Inventory — confirm the active loop's card shows a "Show steps (3)" button (the initial onboarding action plus the two you just added), collapsed by default. Click it — confirm it expands to a list with all 3 steps in order (oldest first: "Fill holes in wall", "Add panels", "Paint panels"), each with a date. Click "Hide steps" — confirm it collapses again. Kill or park the loop and confirm the step history is still visible on its card afterward (any status). Reload the page and confirm the log persisted.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: show each loop's step history on Loop Inventory"
```
