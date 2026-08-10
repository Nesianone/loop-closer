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

// A loop with status 'parked' AND a non-empty coping_plan was active at some
// point (coping_plan is only ever set below, and only when a loop becomes
// active) and was later parked instead of shipped or killed. Blocking new
// activations while one exists stops parking from doubling as a way to grab
// a different active loop without ever resolving the old one — exactly the
// switching behavior this app exists to make harder. A parked loop with no
// coping_plan was never active (e.g. created directly as parked via
// onboarding or the New Loop modal), so it doesn't count. `excludeLoopId` lets
// setActive exclude the loop being (re)activated from counting against itself
// — reactivating your own parked loop is the intended resolution path, not
// something this check should block.
export function hasUnresolvedParkedLoop(data, excludeLoopId = null) {
  return data.loops.some((l) => l.id !== excludeLoopId && l.status === 'parked' && l.coping_plan);
}

export function createLoop(data, { title, domain, next_action, coping_plan, status, resumption_plan, kill_reason, kill_note }) {
  if (status === 'active' && getActiveLoop(data)) {
    throw new Error('Another loop is already active. Park or kill it first.');
  }
  if (status === 'active' && hasUnresolvedParkedLoop(data)) {
    throw new Error('Resume or kill your parked loop before activating a new one.');
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
    checkin_history: [],
    action_log: next_action ? [{ date: todayISODate(), text: next_action }] : []
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
  if (hasUnresolvedParkedLoop(data, loopId)) {
    throw new Error('Resume or kill your parked loop before activating a new one.');
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
  if (next_action) {
    // Loops created before this field existed won't have it in their stored
    // data (loaded fresh from localStorage) — guard so this doesn't throw.
    if (!loop.action_log) loop.action_log = [];
    loop.action_log.push({ date: todayISODate(), text: next_action });
  }
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
