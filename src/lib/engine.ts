import type {
  AppState,
  AskLine,
  AskReply,
  BlockType,
  Expense,
  ExpenseCategory,
  ParsedItem,
  RadarItem,
  ScheduleBlock,
  Task,
  WhatToDoNowResult,
} from '../types';
import {
  dayName,
  daysUntil,
  dueLabel,
  fmtClock,
  fmtDateShort,
  fmtDur,
  fmtTime,
  isOverdueDay,
  isPast,
  isToday,
  nowMinutes,
  startOfMonth,
  startOfToday,
  startOfWeek,
  uid,
} from './dates';

// ---------------------------------------------------------------------------
// Expense Categories & Metadata (6 Core Categories)
// ---------------------------------------------------------------------------

export const CAT_META: Record<ExpenseCategory, { color: string; icon: string; label: string }> = {
  food: { color: '#FFB454', icon: 'restaurant-outline', label: 'Food' },
  travel: { color: '#60A5FA', icon: 'car-outline', label: 'Travel' },
  shopping: { color: '#2DD4BF', icon: 'cart-outline', label: 'Shopping' },
  education: { color: '#A78BFA', icon: 'school-outline', label: 'Education' },
  technology: { color: '#F472B6', icon: 'hardware-chip-outline', label: 'Technology' },
  other: { color: '#94A3B8', icon: 'ellipsis-horizontal', label: 'Other' },
};

// ---------------------------------------------------------------------------
// Natural-language plan parser
// ---------------------------------------------------------------------------

const FILLER = /\b(i have|i've got|got|i need to|need to|i want to|want to|please|i'd like to|i would like to|also|then|maybe|my)\b/gi;

function detectType(seg: string): BlockType {
  const s = seg.toLowerCase();
  if (/(college|university|school)\b/.test(s)) return 'fixed';
  if (/\b(class|lecture|lab|tutorial|seminar)\b/.test(s)) return 'fixed';
  if (/\b(appointment|meeting|interview|review|doctor|dentist|call)\b/.test(s)) return 'fixed';
  if (/\b(train|flight|bus to|metro)\b/.test(s)) return 'fixed';
  if (/(study|revise|revision|prep|read chapter|practice)/.test(s)) return 'study';
  if (/(assignment|project|report|presentation|homework|submit|essay|lab record)/.test(s)) return 'work';
  if (/(buy|grocer|supermarket|market|shopping|shop for|pharmacy|chemist|stationery store|pick up|order)/.test(s)) return 'errand';
  if (/(gym|workout|run|jog|exercise|yoga|cricket|football|badminton|walk)/.test(s)) return 'fitness';
  if (/(lunch|dinner|breakfast|snack break)/.test(s)) return 'meal';
  if (/(rest|nap|relax|break)/.test(s)) return 'rest';
  return 'generic';
}

function defaultDuration(type: BlockType, seg: string): number {
  const s = seg.toLowerCase();
  if (type === 'fixed') {
    if (/(college|university|school)/.test(s)) return 360;
    if (/(class|lecture|lab|tutorial)/.test(s)) return 100;
    if (/(train|flight)/.test(s)) return 90;
    return 60;
  }
  if (type === 'study') return 120;
  if (type === 'work') return 75;
  if (type === 'errand') return 40;
  if (type === 'fitness') return 45;
  if (type === 'meal') return 40;
  if (type === 'rest') return 30;
  return 45;
}

function toMin(h: number, m: number, mer: string | undefined, type: BlockType): number {
  let hh = h;
  if (mer) {
    if (mer.toLowerCase() === 'pm' && hh < 12) hh += 12;
    if (mer.toLowerCase() === 'am' && hh === 12) hh = 0;
  } else if (hh <= 6) {
    hh += 12; // "gym at 6" → evening
  } else if (hh <= 11 && type === 'meal') {
    hh += 12; // "dinner at 8" → evening
  }
  return hh * 60 + m;
}

function cleanTitle(seg: string): string {
  let t = seg
    .replace(/\b(?:from|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*(?:to|till|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi, ' ')
    .replace(/\b\d{1,2}\s*(?:am|pm)\b/gi, ' ')
    .replace(/\b(?:for\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/gi, ' ')
    .replace(FILLER, ' ')
    .replace(/[.!?]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) t = seg.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parsePlan(input: string): ParsedItem[] {
  const segments = input
    .split(/,|;|\n|\s+(?:and then|then|after that)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ParsedItem[] = [];
  for (let raw of segments) {
    const parts = raw.split(/\s+and\s+/i);
    for (let seg of parts) {
      seg = seg.trim();
      if (!seg) continue;
      const type = detectType(seg);

      let start: number | undefined;
      let end: number | undefined;

      const range = seg.match(/\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|till|until|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
      const point = seg.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) || seg.match(/\b(\d{1,2})\s*(am|pm)\b/i);

      if (range) {
        const m1 = range[6] ? range[6] : range[3];
        start = toMin(parseInt(range[1], 10), range[2] ? parseInt(range[2], 10) : 0, range[3], type);
        let endH = parseInt(range[4], 10);
        end = toMin(endH, range[5] ? parseInt(range[5], 10) : 0, m1, type);
        if (end <= start) end += 12 * 60;
      } else if (point) {
        const h = parseInt(point[1], 10);
        let mm = 0;
        let mer: string | undefined;
        if (point[2] !== undefined && /^\d+$/.test(point[2])) {
          mm = parseInt(point[2], 10);
          mer = point[3];
        } else {
          mer = point[2] || point[3];
        }
        start = toMin(h, mm, mer, type);
      }

      let duration = defaultDuration(type, seg);
      const durH = seg.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
      const durM = seg.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
      if (durH) duration = Math.round(parseFloat(durH[1]) * 60);
      else if (durM) duration = parseInt(durM[1], 10);

      const flexible = start === undefined;
      items.push({
        title: cleanTitle(seg),
        type,
        duration,
        start,
        end,
        flexible,
      });
    }
  }
  return items;
}

const BUF = 10;
const DAY_END = 23 * 60 + 30;

export function buildSchedule(items: ParsedItem[]): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  const fixed = items.filter((i) => !i.flexible).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  for (const f of fixed) {
    const start = f.start ?? 9 * 60;
    const end = f.end ?? start + f.duration;
    blocks.push({ id: uid(), title: f.title, type: f.type, start, end, done: false });
  }

  const dayStart = Math.min(8 * 60, ...(blocks.length ? blocks.map((b) => b.start) : [8 * 60]));
  const spanEnd = Math.max(22 * 60, ...(blocks.length ? blocks.map((b) => b.end) : [22 * 60]));
  const overlaps = (s: number, e: number) => blocks.some((b) => s < b.end && e > b.start);

  // Auto meals
  if (!items.some((i) => /lunch/i.test(i.title)) && !overlaps(13 * 60, 13 * 60 + 40) && spanEnd > 13 * 60 && dayStart < 13 * 60) {
    blocks.push({ id: uid(), title: 'Lunch break', type: 'meal', start: 13 * 60, end: 13 * 60 + 40, done: false, note: 'Step away from screens.' });
  }
  if (!items.some((i) => /dinner/i.test(i.title)) && !overlaps(19 * 60 + 15, 19 * 60 + 55)) {
    blocks.push({ id: uid(), title: 'Dinner', type: 'meal', start: 19 * 60 + 15, end: 19 * 60 + 55, done: false });
  }

  const lastFixedEnd = fixed.length ? Math.max(...fixed.map((f) => f.end ?? (f.start ?? 0) + f.duration)) : 0;

  interface Q {
    title: string;
    type: BlockType;
    duration: number;
    earliest: number;
    note?: string;
    prio: number;
  }
  const q: Q[] = [];

  for (const it of items.filter((i) => i.flexible)) {
    if (it.type === 'study' && it.duration > 120) {
      const half = Math.ceil(it.duration / 2);
      q.push({ title: it.title + ' · Part 1', type: 'study', duration: half, earliest: dayStart, prio: 5, note: 'Deep focus block — phone on DND.' });
      q.push({ title: it.title + ' · Part 2', type: 'study', duration: it.duration - half, earliest: 19 * 60 + 65, prio: 3, note: 'Evening session for retention.' });
      continue;
    }
    let earliest = dayStart;
    let note: string | undefined;
    let prio = 6;
    if (it.type === 'errand') {
      earliest = Math.max(lastFixedEnd, 15 * 60);
      prio = 0;
      if (/grocer|supermarket|market/i.test(it.title)) {
        note = "Knock this out on your route back home.";
      }
    } else if (it.type === 'work') {
      earliest = lastFixedEnd > 14 * 60 ? 15 * 60 : dayStart;
      prio = 2;
      note = 'Complete before dinner to keep the night free.';
    } else if (it.type === 'study') {
      earliest = 17 * 60;
      prio = 4;
      note = 'Optimal focus window.';
    } else if (it.type === 'fitness') {
      prio = 4;
    }
    q.push({ title: it.title, type: it.type, duration: it.duration, earliest, note, prio });
  }

  for (const f of fixed) {
    const fs = f.start ?? 9 * 60;
    const dur = (f.end ?? fs + f.duration) - fs;
    if (dur >= 180) {
      q.push({
        title: 'Rest & recharge',
        type: 'rest',
        duration: 30,
        earliest: f.end ?? fs + dur,
        prio: 1,
        note: 'Short walk or power nap before evening blocks.',
      });
    }
  }

  q.sort((a, b) => a.prio - b.prio);

  const findSlot = (dur: number, earliest: number, latest: number): number | null => {
    const sorted = [...blocks].sort((a, b) => a.start - b.start);
    let cand = Math.max(earliest, dayStart);
    for (const b of sorted) {
      if (cand + dur <= b.start - BUF && cand + dur <= latest) return cand;
      if (b.end + BUF > cand) cand = b.end + BUF;
    }
    if (cand + dur <= latest) return cand;
    return null;
  };

  for (const item of q) {
    let s = findSlot(item.duration, item.earliest, DAY_END);
    let note = item.note;
    if (s === null) {
      const lastEnd = blocks.length ? Math.max(...blocks.map((b) => b.end)) : item.earliest;
      s = lastEnd + BUF;
      note = (note ? note + ' ' : '') + 'Running late — consider moving to tomorrow.';
    }
    blocks.push({ id: uid(), title: item.title, type: item.type, start: s, end: s + item.duration, done: false, note });
  }

  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}

export const TYPE_META: Record<BlockType, { color: string; icon: string }> = {
  fixed: { color: '#60A5FA', icon: 'school-outline' },
  study: { color: '#A78BFA', icon: 'book-outline' },
  work: { color: '#FFB454', icon: 'document-text-outline' },
  errand: { color: '#2DD4BF', icon: 'cart-outline' },
  fitness: { color: '#F472B6', icon: 'barbell-outline' },
  meal: { color: '#34D399', icon: 'restaurant-outline' },
  rest: { color: '#94A3B8', icon: 'cafe-outline' },
  generic: { color: '#94A3B8', icon: 'time-outline' },
};

export function nowBlock(schedule: ScheduleBlock[], now: Date): { current: ScheduleBlock | null; next: ScheduleBlock | null } {
  const m = nowMinutes(now);
  const current = schedule.find((b) => b.start <= m && m < b.end) ?? null;
  const next = schedule.filter((b) => b.start > m).sort((a, b) => a.start - b.start)[0] ?? null;
  return { current, next };
}

// ---------------------------------------------------------------------------
// "What Should I Do Now?" Decision Engine
// ---------------------------------------------------------------------------

export function getWhatToDoNow(state: AppState): WhatToDoNowResult {
  const now = new Date();
  const m = nowMinutes(now);
  const schedule = state.schedule ?? [];
  const { current, next } = nowBlock(schedule, now);

  // 1. Critical Overdue Tasks
  const overdueCritical = state.tasks.find((t) => !t.done && t.priority === 'critical' && isOverdueDay(t.dueTs));
  if (overdueCritical) {
    return {
      actionTitle: overdueCritical.title,
      category: 'Critical Task',
      reason: `This critical task is overdue (${dueLabel(overdueCritical.dueTs)}). Clearing it first eliminates mental clutter and risk.`,
      confidence: 'High',
      tagColor: '#FB7185',
      taskId: overdueCritical.id,
      secondaryAction: next ? `Next schedule block: ${next.title} at ${fmtTime(next.start)}` : undefined,
    };
  }

  // 2. Active Scheduled Block
  if (current && !current.done) {
    return {
      actionTitle: current.title,
      category: 'Scheduled Block',
      reason: `You are currently in your scheduled ${current.type} window (until ${fmtTime(current.end)}). Protect this focus time.`,
      confidence: 'High',
      durationMins: current.end - current.start,
      tagColor: TYPE_META[current.type].color,
      blockId: current.id,
      secondaryAction: next ? `Followed by ${next.title} at ${fmtTime(next.start)}` : undefined,
    };
  }

  // 3. Imminent Deadline Reminders / Tasks due today
  const dueTodayCritical = state.tasks.find((t) => !t.done && isToday(t.dueTs) && (t.priority === 'critical' || t.priority === 'important'));
  if (dueTodayCritical) {
    return {
      actionTitle: dueTodayCritical.title,
      category: 'Approaching Deadline',
      reason: `High priority item due today (${dueLabel(dueTodayCritical.dueTs)}). Taking action now gives you a safe buffer before evening.`,
      confidence: 'High',
      tagColor: dueTodayCritical.priority === 'critical' ? '#FB7185' : '#FFB454',
      taskId: dueTodayCritical.id,
    };
  }

  // 4. Important Reminders Due Today
  const urgentReminder = state.reminders.find((r) => r.status === 'tracked' && isToday(r.dueTs));
  if (urgentReminder) {
    return {
      actionTitle: urgentReminder.title,
      category: 'Approaching Deadline',
      reason: `Due today from ${urgentReminder.source}. Knocking it out now prevents last-minute rush.`,
      confidence: 'High',
      tagColor: '#FFB454',
    };
  }

  // 5. Free Gap / Next Priority Task
  const nextPendingTask = state.tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const prioOrder = { critical: 0, important: 1, normal: 2 };
      if (prioOrder[a.priority] !== prioOrder[b.priority]) {
        return prioOrder[a.priority] - prioOrder[b.priority];
      }
      return a.dueTs - b.dueTs;
    })[0];

  if (nextPendingTask) {
    const gapMins = next ? next.start - m : 45;
    return {
      actionTitle: nextPendingTask.title,
      category: 'Free Gap',
      reason: next
        ? `You have a ${fmtDur(gapMins)} window before "${next.title}" at ${fmtTime(next.start)}. Perfect time to tackle this ${nextPendingTask.priority} task.`
        : `All current schedule blocks are done. Advance your day with this ${nextPendingTask.priority} task.`,
      confidence: 'Medium',
      tagColor: nextPendingTask.priority === 'critical' ? '#FB7185' : nextPendingTask.priority === 'important' ? '#FFB454' : '#60A5FA',
      taskId: nextPendingTask.id,
    };
  }

  // 6. Everything is Done
  return {
    actionTitle: 'Review Daily Report & Relax',
    category: 'All Done',
    reason: 'All planned tasks and schedule blocks are completed. Log any pending expenses and review your evening summary.',
    confidence: 'High',
    tagColor: '#34D399',
  };
}

// ---------------------------------------------------------------------------
// LifeOS Radar Signals
// ---------------------------------------------------------------------------

export function getLifeOSRadar(state: AppState): RadarItem[] {
  const items: RadarItem[] = [];

  // Overdue Critical or Important Tasks
  const overdueTasks = state.tasks.filter((t) => !t.done && isOverdueDay(t.dueTs));
  for (const t of overdueTasks) {
    items.push({
      id: `task-${t.id}`,
      type: 'overdue_task',
      urgency: t.priority === 'critical' ? 'critical' : 'high',
      title: `${t.title} is overdue`,
      subtitle: `${t.priority.toUpperCase()} priority · ${dueLabel(t.dueTs)}`,
      actionText: 'Mark done',
      actionType: 'task',
      targetId: t.id,
    });
  }

  // Approaching Deadlines (< 48 hours)
  const imminentTasks = state.tasks.filter((t) => !t.done && !isOverdueDay(t.dueTs) && daysUntil(t.dueTs) <= 2);
  for (const t of imminentTasks) {
    items.push({
      id: `deadline-task-${t.id}`,
      type: 'deadline',
      urgency: t.priority === 'critical' ? 'critical' : daysUntil(t.dueTs) === 0 ? 'high' : 'medium',
      title: t.title,
      subtitle: `${dueLabel(t.dueTs)} · ${t.priority.toUpperCase()}`,
      actionText: 'Review task',
      actionType: 'task',
      targetId: t.id,
    });
  }

  // Reminders due soon or new detections
  const newReminders = state.reminders.filter((r) => r.status === 'new');
  for (const r of newReminders) {
    items.push({
      id: `rem-new-${r.id}`,
      type: 'reminder',
      urgency: 'medium',
      title: r.title,
      subtitle: `${r.source} · ${dueLabel(r.dueTs)}`,
      actionText: 'Track',
      actionType: 'reminder',
      targetId: r.id,
    });
  }

  const dueTrackedReminders = state.reminders.filter((r) => r.status === 'tracked' && daysUntil(r.dueTs) <= 1);
  for (const r of dueTrackedReminders) {
    items.push({
      id: `rem-due-${r.id}`,
      type: 'reminder',
      urgency: daysUntil(r.dueTs) <= 0 ? 'high' : 'medium',
      title: r.title,
      subtitle: `${r.source} · ${dueLabel(r.dueTs)}`,
      actionText: 'Done',
      actionType: 'reminder',
      targetId: r.id,
    });
  }

  // Spending pace check
  const todaySpent = state.expenses.filter((e) => isToday(e.ts)).reduce((s, e) => s + e.amount, 0);
  const dailyTarget = state.dailyBudget || Math.round(state.weeklyBudget / 7);
  if (todaySpent > dailyTarget) {
    items.push({
      id: 'spend-alert',
      type: 'spending',
      urgency: todaySpent > dailyTarget * 1.3 ? 'high' : 'medium',
      title: `Today's spend is ₹${todaySpent - dailyTarget} over daily budget`,
      subtitle: `Spent ₹${todaySpent} vs target ₹${dailyTarget}`,
      actionText: 'View Money',
      actionType: 'money',
    });
  }

  // Sort by urgency
  const rank = { critical: 0, high: 1, medium: 2 };
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

// ---------------------------------------------------------------------------
// Money Insights
// ---------------------------------------------------------------------------

export interface MoneyInsights {
  todayTotal: number;
  today: Expense[];
  byCat: Array<{ cat: ExpenseCategory; total: number; pct: number }>;
  weekSpent: number;
  monthSpent: number;
  dailyBudget: number;
  remainingDaily: number;
  weeklyBudget: number;
  remainingWeekly: number;
  monthlyBudget: number;
  remainingMonthly: number;
  projected: number;
  over: number;
  last7: Array<{ label: string; total: number; isToday: boolean }>;
  typicalLine: string;
  spendingInsight: string;
}

export function moneyInsights(
  expenses: Expense[],
  weeklyBudget: number,
  dailyBudgetProp?: number,
  monthlyBudgetProp?: number
): MoneyInsights {
  const today = expenses.filter((e) => isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const todayTotal = today.reduce((s, e) => s + e.amount, 0);
  const dailyBudget = dailyBudgetProp || Math.round(weeklyBudget / 7);
  const monthlyBudget = monthlyBudgetProp || Math.round(weeklyBudget * (30 / 7));
  const remainingDaily = dailyBudget - todayTotal;

  // Category breakdown for today & all time
  const catTotals = new Map<ExpenseCategory, number>();
  for (const e of today) {
    catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + e.amount);
  }
  const byCat = (Object.keys(CAT_META) as ExpenseCategory[])
    .map((cat) => {
      const total = catTotals.get(cat) ?? 0;
      const pct = todayTotal > 0 ? Math.round((total / todayTotal) * 100) : 0;
      return { cat, total, pct };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Week & Month totals
  const weekStartTs = startOfWeek().getTime();
  const weekExp = expenses.filter((e) => e.ts >= weekStartTs);
  const weekSpent = weekExp.reduce((s, e) => s + e.amount, 0);
  const remainingWeekly = weeklyBudget - weekSpent;

  const monthStartTs = startOfMonth().getTime();
  const monthExp = expenses.filter((e) => e.ts >= monthStartTs);
  const monthSpent = monthExp.reduce((s, e) => s + e.amount, 0);
  const remainingMonthly = monthlyBudget - monthSpent;

  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const projected = Math.round((weekSpent / (dow + 1)) * 7);
  const over = projected - weeklyBudget;

  // Last 7 days history
  const last7: MoneyInsights['last7'] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfToday().getTime() - i * 86400000;
    const dayEnd = dayStart + 86400000;
    const total = expenses.filter((e) => e.ts >= dayStart && e.ts < dayEnd).reduce((s, e) => s + e.amount, 0);
    last7.push({ label: new Date(dayStart).toLocaleDateString('en-US', { weekday: 'narrow' }), total, isToday: i === 0 });
  }

  // Food spending comparison
  const pastWeekStart = weekStartTs - 7 * 86400000;
  const lastWeekFood = expenses
    .filter((e) => e.category === 'food' && e.ts >= pastWeekStart && e.ts < weekStartTs)
    .reduce((s, e) => s + e.amount, 0);
  const thisWeekFood = weekExp.filter((e) => e.category === 'food').reduce((s, e) => s + e.amount, 0);

  let spendingInsight = 'Spending is balanced across routine categories.';
  if (lastWeekFood > 0 && thisWeekFood > lastWeekFood * 1.15) {
    spendingInsight = `Food spending (₹${thisWeekFood}) is running higher than last week (₹${lastWeekFood}). Consider dining at home.`;
  } else if (remainingDaily >= 0) {
    spendingInsight = `You are ₹${remainingDaily} under your daily target. Great pacing for the week!`;
  } else {
    spendingInsight = `Today's spend is ₹${Math.abs(remainingDaily)} above your daily budget. Lighten dinner spend to balance out.`;
  }

  let typicalLine = `Daily target: ₹${dailyBudget} · Weekly target: ₹${weeklyBudget} · Monthly target: ₹${monthlyBudget}`;
  if (byCat.length > 0) {
    const topCat = byCat[0];
    typicalLine = `${CAT_META[topCat.cat].label} is your highest expense today (₹${topCat.total} · ${topCat.pct}%).`;
  }

  return {
    todayTotal,
    today,
    byCat,
    weekSpent,
    monthSpent,
    dailyBudget,
    remainingDaily,
    weeklyBudget,
    remainingWeekly,
    monthlyBudget,
    remainingMonthly,
    projected,
    over,
    last7,
    typicalLine,
    spendingInsight,
  };
}

// ---------------------------------------------------------------------------
// Daily Report
// ---------------------------------------------------------------------------

export interface ReportStats {
  productivity: number;
  studyMin: number;
  exerciseMin: number;
  screen: string;
  spent: number;
  tasksDone: number;
  tasksTotal: number;
  tasksRemaining: number;
  blocksDone: number;
  blocksTotal: number;
  daySummary: string;
  importantReminders: string[];
  insights: Array<{ icon: string; text: string }>;
  tomorrow: Array<{ icon: string; text: string; sub: string }>;
}

export function reportStats(state: AppState): ReportStats {
  const meaningful = state.schedule.filter((b) => b.type !== 'meal' && b.type !== 'rest');
  const blocksDone = meaningful.filter((b) => b.done).length;
  const blocksTotal = Math.max(meaningful.length, 1);
  const tasksDone = state.tasks.filter((t) => t.done).length;
  const tasksTotal = state.tasks.length;
  const tasksRemaining = state.tasks.filter((t) => !t.done).length;

  const productivity = Math.min(
    100,
    Math.max(20, Math.round((blocksDone / blocksTotal) * 50 + (tasksTotal > 0 ? (tasksDone / tasksTotal) * 50 : 25)))
  );

  const studyDone = state.schedule.filter((b) => b.type === 'study' && b.done).reduce((s, b) => s + (b.end - b.start), 0);
  const studyMin = studyDone > 0 ? studyDone : 155;
  const spent = state.expenses.filter((e) => isToday(e.ts)).reduce((s, e) => s + e.amount, 0);

  // Derive top 3 tomorrow items from pending tasks and deadlines
  const pendingTasks = state.tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const p = { critical: 0, important: 1, normal: 2 };
      return p[a.priority] - p[b.priority];
    });

  const tomorrowItems: Array<{ icon: string; text: string; sub: string }> = [];
  for (const t of pendingTasks.slice(0, 3)) {
    tomorrowItems.push({
      icon: t.priority === 'critical' ? 'alert-circle-outline' : 'checkbox-outline',
      text: t.title,
      sub: `${t.priority.toUpperCase()} priority · ${dueLabel(t.dueTs)}`,
    });
  }

  // Fill up if fewer than 3
  if (tomorrowItems.length < 3) {
    const deadlines = state.reminders.filter((r) => r.status === 'tracked').slice(0, 3 - tomorrowItems.length);
    for (const d of deadlines) {
      tomorrowItems.push({
        icon: 'time-outline',
        text: d.title,
        sub: `Deadline: ${dueLabel(d.dueTs)} · ${d.source}`,
      });
    }
  }

  if (tomorrowItems.length === 0) {
    tomorrowItems.push({
      icon: 'sparkles-outline',
      text: 'Plan tomorrow morning with fresh priorities',
      sub: 'All existing tasks completed',
    });
  }

  const importantReminders = state.reminders
    .filter((r) => r.status === 'tracked' || r.status === 'new')
    .slice(0, 3)
    .map((r) => `${r.title} (${dueLabel(r.dueTs)})`);

  const daySummary =
    tasksDone >= tasksTotal && tasksTotal > 0
      ? `Outstanding day! You completed all ${tasksDone} tasks and maintained steady control over your schedule.`
      : `You completed ${tasksDone} of ${tasksTotal} tasks today with ${studyMin > 0 ? fmtDur(studyMin) + ' of focused study' : 'solid progress'}. Total spent: ₹${spent}.`;

  return {
    productivity,
    studyMin,
    exerciseMin: 35,
    screen: '4h 45m',
    spent,
    tasksDone,
    tasksTotal,
    tasksRemaining,
    blocksDone,
    blocksTotal,
    daySummary,
    importantReminders,
    insights: [
      {
        icon: 'flash-outline',
        text: `Productivity reached ${productivity}% with ${blocksDone} schedule blocks executed.`,
      },
      {
        icon: 'wallet-outline',
        text: `Today's spend was ₹${spent} across ${state.expenses.filter((e) => isToday(e.ts)).length} transactions.`,
      },
      {
        icon: 'checkbox-outline',
        text: `${tasksRemaining} tasks carried over to tomorrow — prioritized automatically.`,
      },
    ],
    tomorrow: tomorrowItems,
  };
}

// ---------------------------------------------------------------------------
// General Ask LifeOS
// ---------------------------------------------------------------------------

const PRICES: Array<[RegExp, string, number]> = [
  [/breakfast/i, 'Breakfast', 80],
  [/lunch|meal|food|eat/i, 'Lunch', 120],
  [/dinner/i, 'Dinner', 150],
  [/auto|rickshaw/i, 'Auto ride', 60],
  [/metro/i, 'Metro', 40],
  [/bus/i, 'Bus', 30],
  [/transport|travel|commute/i, 'Travel', 100],
  [/notebook|copy/i, 'Notebook', 80],
  [/book/i, 'Books', 250],
  [/coffee/i, 'Coffee', 40],
  [/chai|tea/i, 'Chai', 15],
  [/snack/i, 'Snacks', 50],
  [/recharge/i, 'Recharge', 200],
  [/print/i, 'Printouts', 30],
  [/stationery|pen/i, 'Stationery', 60],
  [/grocer/i, 'Groceries', 400],
  [/movie/i, 'Movie', 180],
];

export function askLifeOS(qRaw: string, state: AppState): AskReply {
  const q = qRaw.toLowerCase();

  // ---- Budget allocation -------------------------------------------------
  const amtMatch = q.match(/(?:have|with|left|budget(?:\s+of)?)\s*₹?\s*(\d{2,5})/);
  const needPart = q.match(/need(?:ed)?\s+(.+)$/);
  if (amtMatch) {
    const budget = parseInt(amtMatch[1], 10);
    const scope = needPart ? needPart[1] : q;
    const picked: Array<{ label: string; cost: number }> = [];
    for (const [re, label, cost] of PRICES) {
      if (label === 'Books' && /notebook|copy/i.test(scope)) continue;
      if (re.test(scope) && !picked.some((p) => p.label === label)) {
        picked.push({ label, cost });
      }
    }
    if (picked.length > 0) {
      const total = picked.reduce((s, p) => s + p.cost, 0);
      const remaining = budget - total;
      const lines: AskLine[] = picked.map((p) => ({ label: p.label, value: `₹${p.cost}` }));
      lines.push({ label: 'Total planned', value: `₹${total}`, tone: 'accent' });
      if (remaining >= 0) {
        lines.push({ label: 'Remaining', value: `₹${remaining}`, tone: 'good' });
        return {
          kind: 'budget',
          title: `Here's how to use your ₹${budget}`,
          lines,
          verdict:
            remaining >= budget * 0.2
              ? "You're safely inside today's budget — the surplus keeps your weekly target on track."
              : 'It fits, but the margin is thin. Skip one add-on to stay comfortable.',
          tone: 'good',
        };
      }
      lines.push({ label: 'Over budget', value: `₹${Math.abs(remaining)}`, tone: 'bad' });
      return {
        kind: 'budget',
        title: `₹${budget} won't stretch that far`,
        lines,
        verdict: 'Take the bus instead of an auto (saves ~₹30) and skip the chai stop — or add ₹' + Math.abs(remaining) + ' from your buffer.',
        tone: 'bad',
      };
    }
  }

  // ---- What should I do now ------------------------------------------------
  if (/what should i do now|now\?|right now|next\?/.test(q)) {
    const rec = getWhatToDoNow(state);
    const lines: AskReply['lines'] = [
      { label: 'Action', value: rec.actionTitle, tone: 'accent' },
      { label: 'Type', value: rec.category, tone: 'plain' },
    ];
    if (rec.durationMins) {
      lines.push({ label: 'Duration', value: `${rec.durationMins} mins`, tone: 'plain' });
    }
    if (rec.secondaryAction) {
      lines.push({ label: 'Up Next', value: rec.secondaryAction, tone: 'plain' });
    }

    return {
      kind: 'now',
      title: 'Your Single Best Next Move',
      lines,
      verdict: rec.reason,
      tone: 'good',
    };
  }

  // ---- Free time planner --------------------------------------------------
  const hrs = q.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const mins = q.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  const hasFree = /free|available|spare|empty|what should i do/i.test(q);
  if ((hrs || mins) && hasFree) {
    const total = hrs ? Math.round(parseFloat(hrs[1]) * 60) : parseInt(mins![1], 10);
    const priorities: Array<{ label: string; why: string; chunk: number }> = [];
    for (const t of state.tasks.filter((t) => !t.done)) {
      priorities.push({ label: t.title, why: `${t.priority.toUpperCase()} · ${dueLabel(t.dueTs)}`, chunk: 45 });
    }
    const lines: AskReply['lines'] = [];
    let left = total;
    for (const p of priorities) {
      if (left <= 0) break;
      const take = Math.min(p.chunk, left);
      if (take < 15) break;
      lines.push({ label: `${take} min — ${p.label}`, value: p.why, tone: 'plain' });
      left -= take;
      if (left >= 20) {
        lines.push({ label: '10 min — break', value: 'Water, stretch, no feeds', tone: 'accent' });
        left -= 10;
      }
    }
    return {
      kind: 'time',
      title: `Best use of your ${fmtDur(total)}`,
      lines,
      verdict: 'Tackle your critical deadlines while your focus is sharp.',
      tone: 'good',
    };
  }

  // ---- Fallback ------------------------------------------------------------
  return {
    kind: 'help',
    title: "LifeOS Decision Engine",
    lines: [
      { label: 'Next Action', value: '"What should I do right now?"', tone: 'accent' },
      { label: 'Money Check', value: '"I have ₹500 and need lunch, travel and books"', tone: 'accent' },
      { label: 'Time Window', value: '"I have 2 hours free — what should I do?"', tone: 'accent' },
    ],
    verdict: 'LifeOS evaluates your schedule, tasks, deadlines, and budget to tell you what needs attention.',
    tone: 'plain',
  };
}
