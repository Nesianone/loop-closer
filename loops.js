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

// Consecutive missed days for the active loop, walking back from today
// (not including today, since today may not be over yet), stopping at
// the loop's status_changed_date.
export function computeConsecutiveMisses(loop, today = todayISODate()) {
  let misses = 0;
  let cursor = new Date(today + 'T00:00:00');
  const changedAt = new Date(loop.status_changed_date);
  const boundary = new Date(changedAt.getFullYear(), changedAt.getMonth(), changedAt.getDate());
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
