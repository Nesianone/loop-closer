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
