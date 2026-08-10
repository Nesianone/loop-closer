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
        <select id="sob-kill-reason">
          <option value="lost interest">Lost interest</option>
          <option value="wasn't the right idea">Wasn't the right idea</option>
          <option value="hit a wall I couldn't clear">Hit a wall I couldn't clear</option>
          <option value="other">Other</option>
        </select>
        <textarea id="sob-kill-note" placeholder="Optional note"></textarea>
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
      <select id="ob-kill-reason">
        <option value="lost interest">Lost interest</option>
        <option value="wasn't the right idea">Wasn't the right idea</option>
        <option value="hit a wall I couldn't clear">Hit a wall I couldn't clear</option>
        <option value="other">Other</option>
      </select>
      <textarea id="ob-kill-note" placeholder="Optional note"></textarea>
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
