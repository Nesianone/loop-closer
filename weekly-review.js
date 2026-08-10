// weekly-review.js — review-due detection and recap generation.
// Depends on storage.js's AppData shape; does not touch localStorage directly.

import { removeParkingLotEntry } from './storage.js';
import { hasUnresolvedParkedLoop } from './loops.js';

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
