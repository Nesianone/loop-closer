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
