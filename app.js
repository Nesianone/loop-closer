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
  return div.innerHTML;
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
