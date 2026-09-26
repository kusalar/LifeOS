import type {
  AppState,
  AskLine,
  AskReply,
  BlockType,
  DailyReview,
  Expense,
  ExpenseCategory,
  FocusSession,
  Habit,
  HabitCompletion,
  ParsedItem,
  PersonalInsight,
  Project,
  RadarItem,
  ScheduleBlock,
  Task,
  UsableTimeInfo,
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
  localDateKey,
  nowMinutes,
  parseDateKey,
  shiftDateKey,
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
// Time Awareness & Usable Time Calculations
// ---------------------------------------------------------------------------

export const DEFAULT_WORK_START = 9 * 60; // 09:00 AM (540 mins)
export const DEFAULT_WORK_END = 21 * 60; // 09:00 PM (1260 mins)

export function getUsableTimeToday(
  schedule: ScheduleBlock[] = [],
  now: Date = new Date(),
  workStart: number = DEFAULT_WORK_START,
  workEnd: number = DEFAULT_WORK_END
): UsableTimeInfo {
  const m = nowMinutes(now);
  const totalWindowMins = Math.max(0, workEnd - workStart);

  // Scheduled time overlapping the working window today
  let scheduledMinutes = 0;
  for (const b of schedule) {
    const s = Math.max(b.start, workStart);
    const e = Math.min(b.end, workEnd);
    if (e > s) {
      scheduledMinutes += e - s;
    }
  }

  const totalUsableMinutes = Math.max(0, totalWindowMins - scheduledMinutes);

  // Remaining usable time from current time until window end
  let remainingUsableMinutes = 0;
  if (m < workEnd) {
    const curStart = Math.max(m, workStart);
    const windowLeft = workEnd - curStart;

    let remainingScheduled = 0;
    for (const b of schedule) {
      const s = Math.max(b.start, curStart);
      const e = Math.min(b.end, workEnd);
      if (e > s) {
        remainingScheduled += e - s;
      }
    }
    remainingUsableMinutes = Math.max(0, windowLeft - remainingScheduled);
  }

  return {
    windowStart: workStart,
    windowEnd: workEnd,
    totalUsableMinutes,
    remainingUsableMinutes,
    scheduledMinutes,
    formattedRemaining: fmtDur(remainingUsableMinutes),
    formattedScheduled: fmtDur(scheduledMinutes),
    formattedTotal: fmtDur(totalUsableMinutes),
  };
}

// ---------------------------------------------------------------------------
// Project Helpers & Progress Calculations
// ---------------------------------------------------------------------------

export interface ProjectStats {
  total: number;
  completed: number;
  incomplete: number;
  pct: number;
  hasOverdue: boolean;
  hasCritical: boolean;
}

export function getProjectStats(project: Project, tasks: Task[] = []): ProjectStats {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const total = projectTasks.length;
  const completed = projectTasks.filter((t) => t.done).length;
  const incomplete = total - completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasOverdue = projectTasks.some((t) => !t.done && isOverdueDay(t.dueTs));
  const hasCritical = projectTasks.some((t) => !t.done && t.priority === 'critical');
  return { total, completed, incomplete, pct, hasOverdue, hasCritical };
}

export interface ProjectAttentionItem {
  project: Project;
  reason: string;
  urgency: 'critical' | 'high' | 'medium';
  stats: ProjectStats;
}

export function getProjectsNeedingAttention(
  projects: Project[] = [],
  tasks: Task[] = []
): ProjectAttentionItem[] {
  const attention: ProjectAttentionItem[] = [];

  for (const project of projects) {
    if (project.status !== 'active') continue;
    const stats = getProjectStats(project, tasks);
    if (stats.total > 0 && stats.completed === stats.total) continue;

    const days = project.deadline ? daysUntil(project.deadline) : null;
    const overdueTasks = tasks.filter((t) => t.projectId === project.id && !t.done && isOverdueDay(t.dueTs));
    const criticalTasks = tasks.filter((t) => t.projectId === project.id && !t.done && t.priority === 'critical');

    if (overdueTasks.length > 0) {
      attention.push({
        project,
        reason: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} blocking progress`,
        urgency: 'critical',
        stats,
      });
    } else if (criticalTasks.length > 0 && days !== null && days <= 3) {
      attention.push({
        project,
        reason: `${criticalTasks.length} critical task${criticalTasks.length > 1 ? 's' : ''} · Due in ${days}d`,
        urgency: 'critical',
        stats,
      });
    } else if (days !== null && days <= 2) {
      attention.push({
        project,
        reason: `Deadline in ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days + ' days'} · ${stats.pct}% complete`,
        urgency: 'high',
        stats,
      });
    } else if (criticalTasks.length > 0) {
      attention.push({
        project,
        reason: `Has ${criticalTasks.length} critical priority task${criticalTasks.length > 1 ? 's' : ''}`,
        urgency: 'high',
        stats,
      });
    } else if (days !== null && days <= 5 && stats.pct === 0) {
      attention.push({
        project,
        reason: `Approaching deadline in ${days} days with 0% progress`,
        urgency: 'high',
        stats,
      });
    } else if (days !== null && days <= 7 && stats.pct < 50) {
      attention.push({
        project,
        reason: `${stats.pct}% complete · Due in ${days} days`,
        urgency: 'medium',
        stats,
      });
    }
  }

  const rank = { critical: 0, high: 1, medium: 2 };
  return attention.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

// ---------------------------------------------------------------------------
// Habit Tracking & Streaks
// ---------------------------------------------------------------------------

export interface HabitStreakResult {
  currentStreak: number;
  longestStreak: number;
  isCompletedToday: boolean;
  totalCompletions: number;
}

export function getHabitStreak(
  habitId: string,
  completions: HabitCompletion[] = [],
  todayKey: string = localDateKey()
): HabitStreakResult {
  const habitCompletions = completions.filter((c) => c.habitId === habitId);
  const totalCompletions = habitCompletions.length;
  const uniqueDates = Array.from(new Set(habitCompletions.map((c) => c.dateKey)));
  const dateSet = new Set(uniqueDates);

  const isCompletedToday = dateSet.has(todayKey);

  // Current streak calculation
  let currentStreak = 0;
  let checkKey = isCompletedToday ? todayKey : shiftDateKey(todayKey, -1);

  if (!isCompletedToday && !dateSet.has(checkKey)) {
    currentStreak = 0;
  } else {
    while (dateSet.has(checkKey)) {
      currentStreak++;
      checkKey = shiftDateKey(checkKey, -1);
    }
  }

  // Longest streak calculation
  let longestStreak = 0;
  if (uniqueDates.length > 0) {
    uniqueDates.sort(); // ascending YYYY-MM-DD
    let tempStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = uniqueDates[i - 1];
      const curr = uniqueDates[i];
      if (shiftDateKey(prev, 1) === curr) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    isCompletedToday,
    totalCompletions,
  };
}

export interface TodayHabitItem {
  habit: Habit;
  completed: boolean;
  currentStreak: number;
  longestStreak: number;
}

export interface TodayHabitsSummary {
  habits: TodayHabitItem[];
  totalActive: number;
  completedCount: number;
  pct: number;
}

export function getTodayHabitsSummary(
  habits: Habit[] = [],
  completions: HabitCompletion[] = [],
  todayKey: string = localDateKey()
): TodayHabitsSummary {
  const activeHabits = habits.filter((h) => h.active);
  const items: TodayHabitItem[] = activeHabits.map((h) => {
    const streak = getHabitStreak(h.id, completions, todayKey);
    return {
      habit: h,
      completed: streak.isCompletedToday,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    };
  });

  const completedCount = items.filter((i) => i.completed).length;
  const totalActive = items.length;
  const pct = totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;

  return {
    habits: items,
    totalActive,
    completedCount,
    pct,
  };
}

// ---------------------------------------------------------------------------
// Morning Daily Brief & Evening Review Snapshots
// ---------------------------------------------------------------------------

export interface MorningBrief {
  priorityTasksCount: number;
  scheduledBlocksCount: number;
  approachingDeadlinesCount: number;
  habitsRemainingCount: number;
  availableUsableTime: string;
  mainFocusTitle: string;
  mainFocusReason: string;
  mainFocusCategory: string;
  mainFocusTaskId?: string;
}

export function getMorningBrief(state: AppState, todayKey: string = localDateKey()): MorningBrief {
  const tasks = state.tasks ?? [];
  const schedule = state.schedule ?? [];
  const projects = state.projects ?? [];
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];

  const priorityTasksCount = tasks.filter(
    (t) => !t.done && (t.priority === 'critical' || t.priority === 'important')
  ).length;

  const scheduledBlocksCount = schedule.length;

  const approachingDeadlinesCount =
    tasks.filter((t) => !t.done && !isOverdueDay(t.dueTs) && daysUntil(t.dueTs) <= 2).length +
    projects.filter((p) => p.status === 'active' && p.deadline && daysUntil(p.deadline) <= 2).length;

  const habitSummary = getTodayHabitsSummary(habits, completions, todayKey);
  const habitsRemainingCount = habitSummary.totalActive - habitSummary.completedCount;

  const usable = getUsableTimeToday(schedule, new Date(), state.workDayStart, state.workDayEnd);
  const whatNow = getWhatToDoNow(state);

  return {
    priorityTasksCount,
    scheduledBlocksCount,
    approachingDeadlinesCount,
    habitsRemainingCount: Math.max(0, habitsRemainingCount),
    availableUsableTime: usable.formattedRemaining,
    mainFocusTitle: whatNow.actionTitle,
    mainFocusReason: whatNow.reason,
    mainFocusCategory: whatNow.category,
    mainFocusTaskId: whatNow.taskId,
  };
}

export interface EveningReviewSnapshot {
  dateKey: string;
  completedTasksCount: number;
  totalTasksCount: number;
  completedFocusSessionsCount: number;
  focusMinutesToday: number;
  completedHabitsCount: number;
  totalHabitsCount: number;
  plannedMinutes: number;
  spentAmount: number;
  dailyBudget: number;
  tomorrowDeadlinesCount: number;
  tomorrowPriorityTasksCount: number;
  existingReview?: DailyReview;
}

export function getEveningReviewSnapshot(
  state: AppState,
  todayKey: string = localDateKey()
): EveningReviewSnapshot {
  const tasks = state.tasks ?? [];
  const schedule = state.schedule ?? [];
  const focusSessions = state.focusSessions ?? [];
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];
  const expenses = state.expenses ?? [];
  const reviews = state.dailyReviews ?? [];

  const completedTasksCount = tasks.filter((t) => t.done && isToday(t.createdAt)).length;

  const todaySessions = focusSessions.filter((s) => isToday(s.endedAt));
  const focusMinutesToday = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  const habitSummary = getTodayHabitsSummary(habits, completions, todayKey);
  const plannedMinutes = schedule.reduce((acc, b) => acc + (b.end - b.start), 0);
  const spentAmount = expenses.filter((e) => isToday(e.ts)).reduce((acc, e) => acc + e.amount, 0);

  const tomorrowDeadlinesCount = tasks.filter((t) => !t.done && daysUntil(t.dueTs) === 1).length;
  const tomorrowPriorityTasksCount = tasks.filter(
    (t) => !t.done && daysUntil(t.dueTs) === 1 && (t.priority === 'critical' || t.priority === 'important')
  ).length;

  const existingReview = reviews.find((r) => r.dateKey === todayKey);

  return {
    dateKey: todayKey,
    completedTasksCount,
    totalTasksCount: tasks.length,
    completedFocusSessionsCount: todaySessions.length,
    focusMinutesToday,
    completedHabitsCount: habitSummary.completedCount,
    totalHabitsCount: habitSummary.totalActive,
    plannedMinutes,
    spentAmount,
    dailyBudget: state.dailyBudget ?? 400,
    tomorrowDeadlinesCount,
    tomorrowPriorityTasksCount,
    existingReview,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Personal Insights Engine
// ---------------------------------------------------------------------------

export function getPersonalInsights(state: AppState): PersonalInsight[] {
  const insights: PersonalInsight[] = [];
  const focusSessions = state.focusSessions ?? [];
  const tasks = state.tasks ?? [];
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];
  const projects = state.projects ?? [];
  const expenses = state.expenses ?? [];

  // 1. Focus Insight (requires >= 3 sessions)
  if (focusSessions.length >= 3) {
    const totalMins = focusSessions.reduce((s, f) => s + f.durationMinutes, 0);
    const avg = Math.round(totalMins / focusSessions.length);
    insights.push({
      id: 'insight-focus-avg',
      category: 'focus',
      title: 'Focus Duration',
      observation: `You average ${avg} minutes per focus session.`,
      timePeriod: 'All recorded sessions',
      factualBasis: `Based on ${focusSessions.length} sessions totaling ${fmtDur(totalMins)}.`,
    });

    const projMinutes: Record<string, number> = {};
    for (const f of focusSessions) {
      if (f.projectId) {
        projMinutes[f.projectId] = (projMinutes[f.projectId] ?? 0) + f.durationMinutes;
      }
    }
    const topProjEntry = Object.entries(projMinutes).sort((a, b) => b[1] - a[1])[0];
    if (topProjEntry) {
      const topProj = projects.find((p) => p.id === topProjEntry[0]);
      if (topProj) {
        insights.push({
          id: 'insight-focus-top-proj',
          category: 'focus',
          title: 'Top Focus Project',
          observation: `"${topProj.name}" has received your highest deep-focus time (${fmtDur(topProjEntry[1])}).`,
          timePeriod: 'Project duration',
          factualBasis: `${topProjEntry[1]} minutes dedicated across recorded focus blocks.`,
        });
      }
    }
  }

  // 2. Habit Insight (requires >= 3 completions)
  if (completions.length >= 3) {
    const activeHabits = habits.filter((h) => h.active);
    let bestHabit: { habit: Habit; streak: number } | null = null;

    for (const h of activeHabits) {
      const streak = getHabitStreak(h.id, completions);
      if (streak.currentStreak >= 3) {
        if (!bestHabit || streak.currentStreak > bestHabit.streak) {
          bestHabit = { habit: h, streak: streak.currentStreak };
        }
      }
    }

    if (bestHabit) {
      insights.push({
        id: 'insight-habit-streak',
        category: 'habits',
        title: 'Habit Consistency',
        observation: `"${bestHabit.habit.name}" is your most consistent habit with an active ${bestHabit.streak}-day streak.`,
        timePeriod: 'Current streak',
        factualBasis: `Completed ${bestHabit.streak} consecutive days in your local timezone.`,
      });
    }

    const todayKey = localDateKey();
    const last7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      last7Days.push(shiftDateKey(todayKey, -i));
    }
    const weekCompletions = completions.filter((c) => last7Days.includes(c.dateKey));
    const maxPossible = activeHabits.length * 7;
    if (maxPossible > 0 && weekCompletions.length >= 5) {
      const pct = Math.round((weekCompletions.length / maxPossible) * 100);
      insights.push({
        id: 'insight-habit-rate',
        category: 'habits',
        title: 'Weekly Habit Execution',
        observation: `You completed ${pct}% of planned daily habits this past week.`,
        timePeriod: 'Last 7 days',
        factualBasis: `${weekCompletions.length} of ${maxPossible} habit targets logged.`,
      });
    }
  }

  // 3. Task Completion Patterns (requires >= 3 completed tasks)
  const completedTasks = tasks.filter((t) => t.done);
  if (completedTasks.length >= 3) {
    insights.push({
      id: 'insight-tasks-completed',
      category: 'tasks',
      title: 'Task Output',
      observation: `You have completed ${completedTasks.length} tasks across your active projects and backlog.`,
      timePeriod: 'Lifetime tasks',
      factualBasis: `${completedTasks.length} tasks marked completed out of ${tasks.length} total.`,
    });

    if (completedTasks.length >= 5) {
      const morningTasks = completedTasks.filter((t) => {
        const hour = new Date(t.createdAt).getHours();
        return hour < 14;
      });
      const morningPct = Math.round((morningTasks.length / completedTasks.length) * 100);
      if (morningPct >= 60) {
        insights.push({
          id: 'insight-task-timing',
          category: 'tasks',
          title: 'Peak Productivity',
          observation: 'You complete the majority of your tasks before 2 PM.',
          timePeriod: 'Historical tasks',
          factualBasis: `${morningPct}% of tasks completed during morning and early afternoon windows.`,
        });
      }
    }
  }

  // 4. Estimation Pattern (requires >= 5 tasks with estimations and matching focus sessions)
  const estimatedTasks = tasks.filter((t) => t.done && t.estimatedMinutes && t.estimatedMinutes > 0);
  const tasksWithSessions = estimatedTasks.filter((t) => focusSessions.some((s) => s.taskId === t.id));
  if (tasksWithSessions.length >= 5) {
    let totalEst = 0;
    let totalActual = 0;
    for (const t of tasksWithSessions) {
      totalEst += t.estimatedMinutes!;
      const actual = focusSessions.filter((s) => s.taskId === t.id).reduce((acc, s) => acc + s.durationMinutes, 0);
      totalActual += actual;
    }
    const ratio = totalActual / totalEst;
    if (ratio > 1.2) {
      insights.push({
        id: 'insight-estimation',
        category: 'time',
        title: 'Task Duration Estimation',
        observation: 'You usually spend longer than your estimated task duration.',
        timePeriod: 'Last 5+ estimated tasks',
        factualBasis: `Actual focus averaged ${Math.round((ratio - 1) * 100)}% more than initial estimates.`,
      });
    } else if (ratio >= 0.8 && ratio <= 1.2) {
      insights.push({
        id: 'insight-estimation',
        category: 'time',
        title: 'Task Duration Estimation',
        observation: 'Your task duration estimates closely match your actual focused time.',
        timePeriod: 'Last 5+ estimated tasks',
        factualBasis: `Within 10% variance across ${tasksWithSessions.length} measured tasks.`,
      });
    }
  }

  // 5. Money Pattern
  if (expenses.length >= 5) {
    const pastWeekStart = Date.now() - 7 * 86400000;
    const weekExpenses = expenses.filter((e) => e.ts >= pastWeekStart);
    const weekSpent = weekExpenses.reduce((s, e) => s + e.amount, 0);
    const weeklyTarget = state.weeklyBudget ?? 2800;

    if (weekSpent > weeklyTarget) {
      insights.push({
        id: 'insight-money-pace',
        category: 'money',
        title: 'Spending Velocity',
        observation: `Weekly spending is currently ₹${weekSpent - weeklyTarget} above your weekly target.`,
        timePeriod: 'Past 7 days',
        factualBasis: `Spent ₹${weekSpent} vs ₹${weeklyTarget} baseline.`,
      });
    } else {
      insights.push({
        id: 'insight-money-pace',
        category: 'money',
        title: 'Budget Discipline',
        observation: `Weekly spending is pacing ₹${weeklyTarget - weekSpent} below your weekly target.`,
        timePeriod: 'Past 7 days',
        factualBasis: `Spent ₹${weekSpent} vs ₹${weeklyTarget} target.`,
      });
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// "What Should I Do Now?" Decision Engine
// ---------------------------------------------------------------------------

export function getWhatToDoNow(state: AppState): WhatToDoNowResult {
  const now = new Date();
  const m = nowMinutes(now);
  const schedule = state.schedule ?? [];
  const projects = state.projects ?? [];
  const tasks = state.tasks ?? [];
  const { current, next } = nowBlock(schedule, now);
  const usable = getUsableTimeToday(schedule, now, state.workDayStart, state.workDayEnd);

  const getProjName = (projId?: string) => {
    if (!projId) return undefined;
    return projects.find((p) => p.id === projId)?.name;
  };

  // 0. Active Started Task (User already tapped "Start")
  if (state.activeTaskId) {
    const activeTask = tasks.find((t) => t.id === state.activeTaskId && !t.done);
    if (activeTask) {
      const projName = getProjName(activeTask.projectId);
      const lines: string[] = ['Active session in progress'];
      if (projName) lines.push(`Project: ${projName}`);
      lines.push(`${activeTask.priority.toUpperCase()} priority`);
      if (activeTask.estimatedMinutes) lines.push(`Est. ${activeTask.estimatedMinutes} min`);

      return {
        actionTitle: activeTask.title,
        category: 'Critical Task',
        reason: 'Currently in progress. Stay locked into this focus session or complete it when finished.',
        explanationLines: lines,
        confidence: 'High',
        durationMins: activeTask.estimatedMinutes || 45,
        tagColor: '#34D399',
        taskId: activeTask.id,
        projectId: activeTask.projectId,
        projectName: projName,
        isStarted: true,
        secondaryAction: next ? `Next schedule block: ${next.title} at ${fmtTime(next.start)}` : undefined,
      };
    }
  }

  // 1. Critical Overdue Tasks
  const overdueCritical = tasks.find((t) => !t.done && t.priority === 'critical' && isOverdueDay(t.dueTs));
  if (overdueCritical) {
    const projName = getProjName(overdueCritical.projectId);
    const lines: string[] = ['Critical priority', 'Overdue'];
    if (projName) lines.push(`Project: ${projName}`);
    lines.push(dueLabel(overdueCritical.dueTs));

    return {
      actionTitle: overdueCritical.title,
      category: 'Critical Task',
      reason: `Recommended because: ${lines.join(' · ')}. Clearing it eliminates risk and frees your mental focus.`,
      explanationLines: lines,
      confidence: 'High',
      durationMins: overdueCritical.estimatedMinutes || 45,
      tagColor: '#FB7185',
      taskId: overdueCritical.id,
      projectId: overdueCritical.projectId,
      projectName: projName,
      secondaryAction: next ? `Next schedule block: ${next.title} at ${fmtTime(next.start)}` : undefined,
    };
  }

  // 2. Active Scheduled Block
  if (current && !current.done) {
    return {
      actionTitle: current.title,
      category: 'Scheduled Block',
      reason: `You are currently in your scheduled ${current.type} window (until ${fmtTime(current.end)}). Protect this focus time.`,
      explanationLines: [`Scheduled ${current.type}`, `Ends at ${fmtTime(current.end)}`],
      confidence: 'High',
      durationMins: current.end - current.start,
      tagColor: TYPE_META[current.type].color,
      blockId: current.id,
      secondaryAction: next ? `Followed by ${next.title} at ${fmtTime(next.start)}` : undefined,
    };
  }

  // 3. Imminent Deadline Tasks due today (critical or important)
  const dueTodayCritical = tasks.find(
    (t) => !t.done && isToday(t.dueTs) && (t.priority === 'critical' || t.priority === 'important')
  );
  if (dueTodayCritical) {
    const projName = getProjName(dueTodayCritical.projectId);
    const lines: string[] = [`${dueTodayCritical.priority.toUpperCase()} priority`, 'Due today'];
    if (projName) lines.push(`Project: ${projName}`);
    if (dueTodayCritical.estimatedMinutes) lines.push(`Est. ${dueTodayCritical.estimatedMinutes} min`);

    return {
      actionTitle: dueTodayCritical.title,
      category: 'Approaching Deadline',
      reason: `Recommended because: ${lines.join(' · ')}. Taking action now gives you a safe buffer before evening.`,
      explanationLines: lines,
      confidence: 'High',
      durationMins: dueTodayCritical.estimatedMinutes || 45,
      tagColor: dueTodayCritical.priority === 'critical' ? '#FB7185' : '#FFB454',
      taskId: dueTodayCritical.id,
      projectId: dueTodayCritical.projectId,
      projectName: projName,
      secondaryAction: next ? `Next schedule block: ${next.title} at ${fmtTime(next.start)}` : undefined,
    };
  }

  // 4. Important Reminders Due Today
  const urgentReminder = state.reminders?.find((r) => r.status === 'tracked' && isToday(r.dueTs));
  if (urgentReminder) {
    return {
      actionTitle: urgentReminder.title,
      category: 'Approaching Deadline',
      reason: `Recommended because: Tracked reminder from ${urgentReminder.source} due today. Knocking it out prevents last-minute rush.`,
      explanationLines: ['Tracked reminder', 'Due today', urgentReminder.source],
      confidence: 'High',
      tagColor: '#FFB454',
    };
  }

  // 5. Intelligent Ranking for Free Gap / Next Priority Task
  const pendingTasks = tasks.filter((t) => !t.done);
  if (pendingTasks.length > 0) {
    const gapMins = next ? Math.max(0, next.start - m) : usable.remainingUsableMinutes || 60;
    const attentionProjects = getProjectsNeedingAttention(projects, tasks);
    const attentionProjIds = new Set(attentionProjects.map((a) => a.project.id));

    // Deterministic explainable scoring
    const scored = pendingTasks.map((t) => {
      let score = 0;
      const reasons: string[] = [];

      // Priority weight
      if (t.priority === 'critical') {
        score += 50;
        reasons.push('High priority');
      } else if (t.priority === 'important') {
        score += 30;
        reasons.push('Important priority');
      } else {
        score += 10;
        reasons.push('Normal priority');
      }

      // Overdue or due proximity
      if (isOverdueDay(t.dueTs)) {
        score += 40;
        reasons.push('Overdue');
      } else if (isToday(t.dueTs)) {
        score += 35;
        reasons.push('Due today');
      } else {
        const days = daysUntil(t.dueTs);
        if (days === 1) {
          score += 25;
          reasons.push('Due tomorrow');
        } else if (days <= 3) {
          score += 15;
          reasons.push(`Due in ${days} days`);
        }
      }

      // Project context
      const proj = projects.find((p) => p.id === t.projectId);
      if (proj) {
        if (attentionProjIds.has(proj.id)) {
          score += 20;
          reasons.push(`Project "${proj.name}" needs attention`);
        } else if (proj.status === 'active') {
          score += 10;
          reasons.push(`Project "${proj.name}"`);
        }
      }

      // Duration fit
      const est = t.estimatedMinutes || 45;
      if (gapMins >= est) {
        score += 15;
        reasons.push(`Fits your available time`);
      }

      return { task: t, score, reasons, est, proj };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const bestTask = best.task;
    const projName = best.proj?.name;

    return {
      actionTitle: bestTask.title,
      category: 'Free Gap',
      reason: `Recommended because: ${best.reasons.join(' · ')}.`,
      explanationLines: best.reasons,
      confidence: bestTask.priority === 'critical' || isToday(bestTask.dueTs) ? 'High' : 'Medium',
      durationMins: best.est,
      tagColor:
        bestTask.priority === 'critical'
          ? '#FB7185'
          : bestTask.priority === 'important'
          ? '#FFB454'
          : '#60A5FA',
      taskId: bestTask.id,
      projectId: bestTask.projectId,
      projectName: projName,
      secondaryAction: next
        ? `Next block: ${next.title} at ${fmtTime(next.start)} (${fmtDur(gapMins)} free)`
        : usable.remainingUsableMinutes > 0
        ? `${usable.formattedRemaining} usable time remaining today`
        : undefined,
    };
  }

  // 6. Habit Check before "All Done" (Habits do not override urgent tasks)
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];
  const activeHabits = habits.filter((h) => h.active);
  const incompleteHabit = activeHabits.find((h) => {
    const streak = getHabitStreak(h.id, completions);
    return !streak.isCompletedToday;
  });

  if (incompleteHabit) {
    const streak = getHabitStreak(incompleteHabit.id, completions);
    return {
      actionTitle: `Complete Habit: ${incompleteHabit.name}`,
      category: 'Free Gap',
      reason: streak.currentStreak > 0
        ? `All urgent tasks are clear. Protect your ${streak.currentStreak}-day streak for ${incompleteHabit.name}.`
        : `All urgent tasks are clear. Knock out today's ${incompleteHabit.name} habit.`,
      explanationLines: ['Daily habit target', `${streak.currentStreak}-day streak`],
      confidence: 'Medium',
      durationMins: 20,
      tagColor: incompleteHabit.color || '#A78BFA',
    };
  }

  // 7. Everything is Done
  return {
    actionTitle: 'Review Daily Report & Relax',
    category: 'All Done',
    reason: 'All planned tasks, habits, and schedule blocks are completed. Log any pending expenses and review your evening summary.',
    explanationLines: ['All tasks completed', 'Habits completed', 'Schedule blocks finished'],
    confidence: 'High',
    tagColor: '#34D399',
  };
}

// ---------------------------------------------------------------------------
// LifeOS Radar Signals
// ---------------------------------------------------------------------------

export function getLifeOSRadar(state: AppState): RadarItem[] {
  const items: RadarItem[] = [];
  const tasks = state.tasks ?? [];
  const reminders = state.reminders ?? [];
  const projects = state.projects ?? [];
  const expenses = state.expenses ?? [];
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];

  // Overdue Critical or Important Tasks
  const overdueTasks = tasks.filter((t) => !t.done && isOverdueDay(t.dueTs));
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
      projectId: t.projectId,
    });
  }

  // Approaching Deadlines (< 48 hours)
  const imminentTasks = tasks.filter((t) => !t.done && !isOverdueDay(t.dueTs) && daysUntil(t.dueTs) <= 2);
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
      projectId: t.projectId,
    });
  }

  // Project Deadlines & Blockers
  for (const p of projects) {
    if (p.status !== 'active') continue;
    const stats = getProjectStats(p, tasks);
    if (stats.total > 0 && stats.completed === stats.total) continue;

    if (p.deadline) {
      const days = daysUntil(p.deadline);
      if (days <= 2) {
        items.push({
          id: `proj-dl-${p.id}`,
          type: 'project_deadline',
          urgency: days <= 1 ? 'critical' : 'high',
          title: `Project deadline: ${p.name}`,
          subtitle: `Due ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'} · ${stats.pct}% done (${stats.completed}/${stats.total} tasks)`,
          actionText: 'View Project',
          actionType: 'project',
          projectId: p.id,
        });
      }
    }

    if (stats.hasOverdue) {
      items.push({
        id: `proj-blk-${p.id}`,
        type: 'project_blocked',
        urgency: 'high',
        title: `${p.name} has overdue tasks`,
        subtitle: `${stats.incomplete} pending · progress blocked`,
        actionText: 'View Project',
        actionType: 'project',
        projectId: p.id,
      });
    }
  }

  // Habit Streak at Risk (Evening check if streak >= 2 and uncompleted today)
  const nowHour = new Date().getHours();
  if (nowHour >= 17) {
    for (const h of habits.filter((h) => h.active)) {
      const streak = getHabitStreak(h.id, completions);
      if (!streak.isCompletedToday && streak.currentStreak >= 2) {
        items.push({
          id: `habit-risk-${h.id}`,
          type: 'habit',
          urgency: 'medium',
          title: `Protect your ${h.name} streak`,
          subtitle: `${streak.currentStreak}-day streak active · Complete today`,
          actionText: 'Check off',
          actionType: 'habit',
          targetId: h.id,
        });
      }
    }
  }

  // Reminders due soon or new detections
  const newReminders = reminders.filter((r) => r.status === 'new');
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

  const dueTrackedReminders = reminders.filter((r) => r.status === 'tracked' && daysUntil(r.dueTs) <= 1);
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
  const todaySpent = expenses.filter((e) => isToday(e.ts)).reduce((s, e) => s + e.amount, 0);
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
  tasksOverdue: number;
  tasksCompletionRate: number;
  blocksDone: number;
  blocksTotal: number;
  daySummary: string;
  importantReminders: string[];
  insights: Array<{ icon: string; text: string }>;
  tomorrow: Array<{ icon: string; text: string; sub: string }>;
  // Phase 6 & 7 additions
  focusTotalThisWeek: number;
  focusAvgSession: number | null;
  topFocusedProjectName: string | null;
  focusSessionsCount: number;
  habitsCompletionRate: number | null;
  habitsCurrentStreak: number;
  habitsBestStreak: number;
  habitsActiveCount: number;
  timePlannedMinutes: number;
  timeFocusedMinutes: number;
  timeAvailableMinutes: number;
  personalInsights: PersonalInsight[];
}

export function reportStats(state: AppState): ReportStats {
  const schedule = state.schedule ?? [];
  const tasks = state.tasks ?? [];
  const focusSessions = state.focusSessions ?? [];
  const habits = state.habits ?? [];
  const completions = state.habitCompletions ?? [];
  const projects = state.projects ?? [];
  const expenses = state.expenses ?? [];

  const meaningful = schedule.filter((b) => b.type !== 'meal' && b.type !== 'rest');
  const blocksDone = meaningful.filter((b) => b.done).length;
  const blocksTotal = Math.max(meaningful.length, 1);
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const tasksRemaining = tasks.filter((t) => !t.done).length;
  const tasksOverdue = tasks.filter((t) => !t.done && isOverdueDay(t.dueTs)).length;
  const tasksCompletionRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const productivity = Math.min(
    100,
    Math.max(20, Math.round((blocksDone / blocksTotal) * 50 + (tasksTotal > 0 ? (tasksDone / tasksTotal) * 50 : 25)))
  );

  const studyDone = schedule.filter((b) => b.type === 'study' && b.done).reduce((s, b) => s + (b.end - b.start), 0);
  const studyMin = studyDone > 0 ? studyDone : 155;
  const spent = expenses.filter((e) => isToday(e.ts)).reduce((s, e) => s + e.amount, 0);

  // Focus metrics
  const pastWeekStart = Date.now() - 7 * 86400000;
  const weekSessions = focusSessions.filter((s) => s.startedAt >= pastWeekStart);
  const focusTotalThisWeek = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const focusAvgSession =
    focusSessions.length > 0
      ? Math.round(focusSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / focusSessions.length)
      : null;

  let topFocusedProjectName: string | null = null;
  const projMins: Record<string, number> = {};
  for (const s of focusSessions) {
    if (s.projectId) {
      projMins[s.projectId] = (projMins[s.projectId] ?? 0) + s.durationMinutes;
    }
  }
  const topProjEntry = Object.entries(projMins).sort((a, b) => b[1] - a[1])[0];
  if (topProjEntry) {
    const proj = projects.find((p) => p.id === topProjEntry[0]);
    if (proj) topFocusedProjectName = proj.name;
  }

  // Habits metrics
  const activeHabits = habits.filter((h) => h.active);
  let habitsCurrentStreak = 0;
  let habitsBestStreak = 0;
  for (const h of activeHabits) {
    const s = getHabitStreak(h.id, completions);
    if (s.currentStreak > habitsCurrentStreak) habitsCurrentStreak = s.currentStreak;
    if (s.longestStreak > habitsBestStreak) habitsBestStreak = s.longestStreak;
  }

  const todayKey = localDateKey();
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    last7Days.push(shiftDateKey(todayKey, -i));
  }
  const weekCompletions = completions.filter((c) => last7Days.includes(c.dateKey));
  const maxPossibleHabits = activeHabits.length * 7;
  const habitsCompletionRate =
    maxPossibleHabits > 0 ? Math.round((weekCompletions.length / maxPossibleHabits) * 100) : null;

  // Time metrics
  const timePlannedMinutes = schedule.reduce((sum, b) => sum + (b.end - b.start), 0);
  const timeFocusedMinutes = focusSessions
    .filter((s) => isToday(s.startedAt))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const usable = getUsableTimeToday(schedule, new Date(), state.workDayStart, state.workDayEnd);
  const timeAvailableMinutes = usable.remainingUsableMinutes;

  // Derive top 3 tomorrow items from pending tasks and deadlines
  const pendingTasks = tasks
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

  if (tomorrowItems.length < 3) {
    const deadlines = (state.reminders ?? []).filter((r) => r.status === 'tracked').slice(0, 3 - tomorrowItems.length);
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

  const importantReminders = (state.reminders ?? [])
    .filter((r) => r.status === 'tracked' || r.status === 'new')
    .slice(0, 3)
    .map((r) => `${r.title} (${dueLabel(r.dueTs)})`);

  const daySummary =
    tasksDone >= tasksTotal && tasksTotal > 0
      ? `Outstanding day! You completed all ${tasksDone} tasks and maintained steady control over your schedule.`
      : `You completed ${tasksDone} of ${tasksTotal} tasks today with ${studyMin > 0 ? fmtDur(studyMin) + ' of focused study' : 'solid progress'}. Total spent: ₹${spent}.`;

  const personalInsights = getPersonalInsights(state);

  return {
    productivity,
    studyMin,
    exerciseMin: 35,
    screen: '4h 45m',
    spent,
    tasksDone,
    tasksTotal,
    tasksRemaining,
    tasksOverdue,
    tasksCompletionRate,
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
        text: `Today's spend was ₹${spent} across ${expenses.filter((e) => isToday(e.ts)).length} transactions.`,
      },
      {
        icon: 'checkbox-outline',
        text: `${tasksRemaining} tasks carried over to tomorrow — prioritized automatically.`,
      },
    ],
    tomorrow: tomorrowItems,
    focusTotalThisWeek,
    focusAvgSession,
    topFocusedProjectName,
    focusSessionsCount: focusSessions.length,
    habitsCompletionRate,
    habitsCurrentStreak,
    habitsBestStreak,
    habitsActiveCount: activeHabits.length,
    timePlannedMinutes,
    timeFocusedMinutes,
    timeAvailableMinutes,
    personalInsights,
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
    if (rec.projectName) {
      lines.push({ label: 'Project', value: rec.projectName, tone: 'plain' });
    }
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
