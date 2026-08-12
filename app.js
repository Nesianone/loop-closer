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

let onboardingQueue = [];
let onboardingIndex = 0;
let onboardingPhase = 'collect'; // 'collect' | 'decide'

let inventoryFilterStatus = 'all';
let inventoryFilterDomain = 'all';
let inventoryExpandedSteps = new Set();

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
  if (currentView === 'today') { renderToday(); checkStuckOrBored(); }
  else if (currentView === 'inventory') renderInventory();
  else if (currentView === 'parking-lot') renderParkingLot();
  else if (currentView === 'recap-log') renderRecapLog();
  else if (currentView === 'settings') renderSettings();
  else if (currentView === 'onboarding') renderOnboarding();
}

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

// --- Screens (placeholders — replaced one at a time in later tasks) ---
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

function openWeeklyReviewModal() {
  const activeLoop = loops.getActiveLoop(data);
  const canPromote = !activeLoop && !loops.hasUnresolvedParkedLoop(data);

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

function openNewLoopModal() {
  const hasActive = !!loops.getActiveLoop(data);
  // Blocks the same way createLoop's own guard does — see loops.js's
  // hasUnresolvedParkedLoop for why parking your active loop shouldn't be a
  // way to unlock starting a different one.
  const blockActivation = hasActive || loops.hasUnresolvedParkedLoop(data);
  const domainOptions = data.settings.domains.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  openModal(`
    <h3>New Loop</h3>
    <input id="new-loop-title" type="text" placeholder="Title">
    <label>Domain</label>
    <select id="new-loop-domain">${domainOptions}</select>

    <div class="card">
      <h4>Make it active${blockActivation ? ' — disabled, resolve your active/parked loop first' : ''}</h4>
      <textarea id="new-loop-next" placeholder="Next physical step"></textarea>
      <textarea id="new-loop-coping" placeholder="If I get stuck on X, then I will Y"></textarea>
      <button class="btn" id="new-loop-active-submit" ${blockActivation ? 'disabled' : ''}>Set Active</button>
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
    // Unlike the New Loop modal (which can precompute a single "block
    // activation" flag before rendering), each row's Activate button here
    // would need a per-loop check against every OTHER loop to know in advance
    // whether activating THIS one is blocked by a different unresolved parked
    // loop. loops.setActive already enforces that (via hasUnresolvedParkedLoop's
    // excludeLoopId), so it's simpler and just as safe to let it throw and
    // surface the message here rather than duplicating that check per row.
    try {
      loops.setActive(data, loopId, coping_plan);
    } catch (e) {
      alert(e.message);
      return;
    }
    save();
    closeModal();
    renderInventory();
  });
}
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
  // Normally unreachable during a fresh onboarding pass (its own Park path
  // never sets coping_plan, so it can't produce an unresolved parked loop),
  // but reachable if a JSON backup is imported with settings.onboarded:false
  // while already containing a previously-active, now-parked loop — so this
  // is checked the same way New Loop's "Set Active" is, not skipped.
  const blockActivation = hasActive || loops.hasUnresolvedParkedLoop(data);
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
      <h3>Make it active${blockActivation ? ' — disabled, resolve your active/parked loop first' : ''}</h3>
      <textarea id="ob-active-next" placeholder="Next physical step"></textarea>
      <textarea id="ob-active-coping" placeholder="If I get stuck on X, then I will Y"></textarea>
      <button class="btn" id="ob-active-submit" ${blockActivation ? 'disabled' : ''}>Set Active</button>
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
    try {
      loops.createLoop(data, {
        title: item.title,
        domain: el.querySelector('#ob-domain').value,
        next_action,
        coping_plan,
        status: 'active'
      });
    } catch (e) {
      alert(e.message);
      return;
    }
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

// --- Nav & modal wiring ---
document.getElementById('bottom-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) showView(btn.dataset.view);
});

document.getElementById('modal-root').addEventListener('click', (e) => {
  if (e.target.id === 'modal-root' && modalDismissible) closeModal();
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
