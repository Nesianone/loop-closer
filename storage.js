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

export function todayISODate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
