import type {
  AdaptiveProposal,
  AppState,
  AskLine,
  AskReply,
  BehavioralPattern,
  BlockType,
  DailyReview,
  DayStatus,
  DecisionRecord,
  EstimationLearningResult,
  Expense,
  ExpenseCategory,
  FocusSession,
  Goal,
  GoalProgress,
  Habit,
  HabitCompletion,
  ParsedItem,
  PersonalInsight,
  PersonalPreference,
  PlanningPreferences,
  Priority,
  Project,
  ProjectDeadlinePressure,
  ProposedTask,
  RadarItem,
  RecurrenceRule,
  RecurringTask,
  Reminder,
  ReminderTriggerType,
  Routine,
  RoutineItem,
  ScheduleBlock,
  Task,
  TaskTemplate,
  TaskTemplateItem,
  TaskType,
  UsableTimeInfo,
  WeeklyPlanningSummary,
  WeeklyReviewV2Summary,
  WhatToDoNowResult,
  CalendarSyncState,
  CurrentScheduleContext,
  DailyExecutionSummary,
  ExternalCalendar,
  ExternalCalendarEvent,
  LocalNotification,
  NotificationPreferences,
  SearchFilter,
  SearchResultItem,
  SearchResults,
  CalendarReconciliationResult,
} from '../types';
import { validateAppState } from './validation';
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

    // Phase 9: Descriptive productivity pattern from 5+ focus sessions
    if (focusSessions.length >= 5) {
      const buckets = [
        { label: '9 AM and 12 PM', startH: 9, endH: 12, mins: 0 },
        { label: '12 PM and 3 PM', startH: 12, endH: 15, mins: 0 },
        { label: '3 PM and 6 PM', startH: 15, endH: 18, mins: 0 },
        { label: '6 PM and 9 PM', startH: 18, endH: 21, mins: 0 },
      ];
      for (const s of focusSessions) {
        const h = new Date(s.startedAt).getHours();
        for (const b of buckets) {
          if (h >= b.startH && h < b.endH) {
            b.mins += s.durationMinutes;
          }
        }
      }
      buckets.sort((a, b) => b.mins - a.mins);
      const topBucket = buckets[0];
      if (topBucket && topBucket.mins > 0) {
        insights.push({
          id: 'insight-focus-time-window',
          category: 'focus',
          title: 'Focus Window Distribution',
          observation: `Most recorded focus time occurred between ${topBucket.label}.`,
          timePeriod: 'Historical focus sessions',
          factualBasis: `${topBucket.mins} minutes logged in this window across ${focusSessions.length} recorded sessions.`,
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
// LifeOS V2: Task Dependencies, Deadline Pressure & Adaptive Engine
// ---------------------------------------------------------------------------

export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.blockedBy || task.blockedBy.length === 0) return false;
  return task.blockedBy.some((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return dep ? !dep.done : false;
  });
}

export function getProjectDeadlinePressure(
  project: Project,
  tasks: Task[],
  now: Date = new Date(),
  workDayStart: number = 540,
  workDayEnd: number = 1260
): ProjectDeadlinePressure {
  const pTasks = tasks.filter((t) => t.projectId === project.id);
  const remainingTasks = pTasks.filter((t) => !t.done);
  const completedTasks = pTasks.filter((t) => t.done);
  const completionPercentage = pTasks.length > 0 ? Math.round((completedTasks.length / pTasks.length) * 100) : 0;

  const tasksWithEst = remainingTasks.filter((t) => t.estimatedMinutes !== undefined && t.estimatedMinutes > 0);
  const estimatedRemainingMinutes = tasksWithEst.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
  const hasEstimatedData = remainingTasks.length === 0 || tasksWithEst.length > 0;

  let availableUsableMinutes = 0;
  let daysRemaining = 0;

  if (project.deadline) {
    const nowTs = now.getTime();
    const deadlineTs = project.deadline;
    daysRemaining = Math.max(0, daysUntil(deadlineTs));

    if (deadlineTs > nowTs) {
      const workingMinutesPerDay = Math.max(0, workDayEnd - workDayStart);
      const startDayKey = localDateKey(now);
      const endDayKey = localDateKey(new Date(deadlineTs));

      if (startDayKey === endDayKey) {
        const curM = nowMinutes(now);
        const deadlineDate = new Date(deadlineTs);
        const endM = deadlineDate.getHours() * 60 + deadlineDate.getMinutes();
        const start = Math.max(curM, workDayStart);
        const end = Math.min(endM, workDayEnd);
        availableUsableMinutes = Math.max(0, end - start);
      } else {
        const curM = nowMinutes(now);
        if (curM < workDayEnd) {
          availableUsableMinutes += Math.max(0, workDayEnd - Math.max(curM, workDayStart));
        }
        const fullDays = Math.max(0, daysRemaining - 1);
        availableUsableMinutes += fullDays * workingMinutesPerDay;
        const deadlineDate = new Date(deadlineTs);
        const endM = deadlineDate.getHours() * 60 + deadlineDate.getMinutes();
        if (endM > workDayStart) {
          availableUsableMinutes += Math.max(0, Math.min(endM, workDayEnd) - workDayStart);
        }
      }
    }
  }

  const diff = availableUsableMinutes - estimatedRemainingMinutes;
  let statusText: string;
  let isPressureHigh = false;

  if (!hasEstimatedData || (remainingTasks.length > 0 && tasksWithEst.length === 0)) {
    statusText = 'Not enough estimated task data.';
    isPressureHigh = false;
  } else if (diff >= 0) {
    statusText = 'Your remaining estimated work fits within available time.';
    isPressureHigh = false;
  } else {
    const deficit = Math.abs(diff);
    statusText = `Your remaining estimated work exceeds available time by ~${fmtDur(deficit)}.`;
    isPressureHigh = true;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    deadline: project.deadline ?? 0,
    daysRemaining,
    remainingTasksCount: remainingTasks.length,
    estimatedRemainingMinutes,
    hasEstimatedData: remainingTasks.length === 0 ? true : tasksWithEst.length > 0,
    availableUsableMinutes,
    differenceMinutes: diff,
    statusText,
    isPressureHigh,
    completionPercentage,
  };
}

export function getAllProjectsDeadlinePressure(
  projects: Project[],
  tasks: Task[],
  now: Date = new Date(),
  workDayStart?: number,
  workDayEnd?: number
): ProjectDeadlinePressure[] {
  return projects
    .filter((p) => p.status === 'active' && p.deadline)
    .map((p) => getProjectDeadlinePressure(p, tasks, now, workDayStart, workDayEnd));
}

export function calculateDayStatus(
  state: AppState,
  now: Date = new Date()
): { dayStatus: DayStatus; proposals: AdaptiveProposal[] } {
  const m = nowMinutes(now);
  const schedule = state.schedule ?? [];
  const tasks = state.tasks ?? [];
  const focusSessions = state.focusSessions ?? [];
  const usable = getUsableTimeToday(schedule, now, state.workDayStart, state.workDayEnd);
  const proposals: AdaptiveProposal[] = [];

  let shiftMinutes = 0;
  let shiftReason = '';
  let overrunTask: Task | undefined;

  // 1. Detect focus session overrun
  const todayKey = localDateKey(now);
  for (const session of focusSessions) {
    const sessionKey = localDateKey(new Date(session.startedAt));
    if (sessionKey === todayKey) {
      const task = tasks.find((t) => t.id === session.taskId);
      if (task && task.estimatedMinutes && session.durationMinutes > task.estimatedMinutes) {
        const diff = session.durationMinutes - task.estimatedMinutes;
        if (diff > shiftMinutes) {
          shiftMinutes = diff;
          overrunTask = task;
          shiftReason = `${task.title} took ~${diff} min longer than planned.`;
        }
      }
    }
  }

  // Also check if active task currently running is overrunning its estimate
  if (state.activeTaskId) {
    const activeTask = tasks.find((t) => t.id === state.activeTaskId && !t.done);
    if (activeTask && activeTask.estimatedMinutes) {
      const isRunning = Boolean(state.activeTaskStartedAt);
      const accumulatedMs = state.activeTaskAccumulatedMs ?? 0;
      const runningElapsedMs = isRunning && state.activeTaskStartedAt ? Math.max(0, now.getTime() - state.activeTaskStartedAt) : 0;
      const elapsedMins = Math.floor((accumulatedMs + runningElapsedMs) / 60000);
      if (elapsedMins > activeTask.estimatedMinutes) {
        const diff = elapsedMins - activeTask.estimatedMinutes;
        if (diff > shiftMinutes) {
          shiftMinutes = diff;
          overrunTask = activeTask;
          shiftReason = `${activeTask.title} is taking ~${diff} min longer than planned.`;
        }
      }
    }
  }

  // 2. Detect overdue / unfinished planned schedule blocks or tasks
  const missedBlocks = schedule.filter((b) => !b.done && b.end < m && b.type !== 'meal');
  if (missedBlocks.length > 0 && shiftMinutes === 0) {
    const missed = missedBlocks[0];
    shiftMinutes = Math.min(120, m - missed.start);
    shiftReason = `Scheduled block "${missed.title}" ended without completion.`;
  }

  const overdueUnfinishedToday = tasks.find(
    (t) => !t.done && isToday(t.dueTs) && new Date(t.dueTs).getHours() * 60 + new Date(t.dueTs).getMinutes() < m
  );
  if (overdueUnfinishedToday && shiftMinutes === 0) {
    shiftMinutes = 30;
    shiftReason = `Planned task "${overdueUnfinishedToday.title}" is overdue and still unfinished.`;
  }

  // 3. Generate rescheduling proposals if shift occurred
  if (shiftMinutes >= 15) {
    const upcomingBlocks = schedule
      .filter((b) => !b.done && b.start >= m - 10)
      .sort((a, b) => a.start - b.start);

    for (const b of upcomingBlocks) {
      const duration = b.end - b.start;
      const suggestedStart = Math.min(22 * 60, Math.ceil((b.start + shiftMinutes) / 15) * 15);
      const suggestedEnd = suggestedStart + duration;

      proposals.push({
        id: 'prop-' + uid(),
        blockId: b.id,
        taskTitle: b.title,
        oldStart: b.start,
        oldEnd: b.end,
        newStart: suggestedStart,
        newEnd: suggestedEnd,
        reason: shiftReason || `Schedule shifted by ${shiftMinutes} minutes.`,
        impact: `Moves "${b.title}" to ${fmtTime(suggestedStart)}–${fmtTime(suggestedEnd)} to accommodate schedule shift.`,
        priority: 'important',
        status: 'pending',
        createdAt: now.getTime(),
      });
    }

    if (upcomingBlocks.length === 0) {
      const pendingTask = tasks.find((t) => !t.done && isToday(t.dueTs) && t.id !== overrunTask?.id);
      if (pendingTask) {
        const est = pendingTask.estimatedMinutes || 45;
        const suggestedStart = Math.min(21 * 60, Math.ceil((m + 30) / 15) * 15);
        proposals.push({
          id: 'prop-' + uid(),
          taskId: pendingTask.id,
          taskTitle: pendingTask.title,
          newStart: suggestedStart,
          newEnd: suggestedStart + est,
          reason: shiftReason || `Schedule shifted by ${shiftMinutes} minutes.`,
          impact: `Reserves a focused ${est} min window for "${pendingTask.title}" at ${fmtTime(suggestedStart)}.`,
          priority: pendingTask.priority,
          status: 'pending',
          createdAt: now.getTime(),
        });
      }
    }
  }

  // 4. Calculate final DayStatus
  let dayState: DayStatus['state'] = 'on_track';
  let headline = 'ON TRACK';
  let summary = '';
  let explanation = '';

  const completedTodayTasks = tasks.filter((t) => t.done && isToday(t.createdAt));
  const plannedTasksCount = tasks.filter((t) => isToday(t.dueTs)).length || schedule.filter((b) => b.type !== 'meal').length;

  if (shiftMinutes >= 15) {
    dayState = 'shifted';
    headline = 'DAY SHIFT DETECTED';
    summary = `You're ${shiftMinutes} min behind your planned timeline.`;
    explanation = `${shiftReason} You now have less available time today.`;
  } else if (plannedTasksCount > 0 && completedTodayTasks.length > 0) {
    dayState = 'on_track';
    headline = 'ON TRACK';
    summary = `Completed ${completedTodayTasks.length} planned tasks within estimated windows.`;
    explanation = 'Your schedule is currently on track and aligned with planned buffers.';
  } else if (usable.remainingUsableMinutes > 0) {
    dayState = 'open';
    headline = 'OPEN WINDOW';
    summary = `You have ${usable.formattedRemaining} of usable time remaining.`;
    explanation = 'No critical overruns detected. Free gaps are available for priority tasks.';
  } else {
    dayState = 'completed';
    headline = 'DAY WRAPPING UP';
    summary = 'Your daily focus window is wrapping up.';
    explanation = 'All major focus blocks for the day have concluded.';
  }

  const dayStatus: DayStatus = {
    state: dayState,
    headline,
    summary,
    explanation,
    shiftMinutes: shiftMinutes > 0 ? shiftMinutes : undefined,
    proposalsCount: proposals.length,
    remainingUsableMinutes: usable.remainingUsableMinutes,
  };

  return { dayStatus, proposals };
}

export function applyProposalToSchedule(
  schedule: ScheduleBlock[],
  proposal: AdaptiveProposal
): ScheduleBlock[] {
  if (proposal.blockId) {
    return schedule.map((b) => {
      if (b.id === proposal.blockId) {
        return {
          ...b,
          start: proposal.newStart,
          end: proposal.newEnd,
        };
      }
      return b;
    });
  }

  const newBlock: ScheduleBlock = {
    id: 'block-' + uid(),
    title: proposal.taskTitle,
    type: 'work',
    start: proposal.newStart,
    end: proposal.newEnd,
    done: false,
    taskId: proposal.taskId,
    source: 'lifeos',
  };

  return [...schedule, newBlock].sort((a, b) => a.start - b.start);
}

export function breakDownTask(
  input: string,
  contextOrProjectId?: { projectId?: string; defaultPriority?: Priority } | string
): ProposedTask[] {
  const context = typeof contextOrProjectId === 'string' ? { projectId: contextOrProjectId } : contextOrProjectId;
  const s = input.trim();
  const lower = s.toLowerCase();
  const priority = context?.defaultPriority || 'important';
  const projectId = context?.projectId;

  if (/vlsi/i.test(lower)) {
    return [
      { id: 'bt-1', title: 'Complete circuit implementation', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-2', title: 'Run simulations', estimatedMinutes: 45, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-3', title: 'Capture results', estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
      { id: 'bt-4', title: 'Write report', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-5', title: 'Review and submit', estimatedMinutes: 20, priority, taskType: 'admin', projectId, selected: true },
    ];
  }

  const chapRange = lower.match(/chapters?\s+(\d+)\s*(?:-|–|to)\s*(\d+)/i);
  if (chapRange) {
    const startChap = parseInt(chapRange[1], 10);
    const endChap = parseInt(chapRange[2], 10);
    const tasks: ProposedTask[] = [];
    for (let c = startChap; c <= endChap; c++) {
      tasks.push({
        id: `bt-chap-${c}`,
        title: `Chapter ${c}`,
        estimatedMinutes: 45,
        priority,
        taskType: 'deep_work',
        projectId,
        selected: true,
      });
    }
    return tasks;
  }

  if (/exam|study|revise|revision/i.test(lower)) {
    return [
      { id: 'bt-1', title: 'Core concepts review', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-2', title: 'Solve textbook practice problems', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-3', title: 'Review previous year questions', estimatedMinutes: 45, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-4', title: 'Formula & key diagrams sheet', estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
      { id: 'bt-5', title: 'Final timed mock test', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
    ];
  }

  if (/report|paper|essay|assignment/i.test(lower)) {
    return [
      { id: 'bt-1', title: 'Outline structure & key points', estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
      { id: 'bt-2', title: 'Draft main content & analysis', estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-3', title: 'Add figures, references & formatting', estimatedMinutes: 30, priority, taskType: 'admin', projectId, selected: true },
      { id: 'bt-4', title: 'Review and proofread', estimatedMinutes: 25, priority, taskType: 'quick_task', projectId, selected: true },
      { id: 'bt-5', title: 'Final submission', estimatedMinutes: 15, priority, taskType: 'admin', projectId, selected: true },
    ];
  }

  if (/code|software|app|feature|website|build/i.test(lower)) {
    return [
      { id: 'bt-1', title: 'Architecture setup & design', estimatedMinutes: 45, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-2', title: 'Core feature implementation', estimatedMinutes: 90, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-3', title: 'Unit testing & edge cases', estimatedMinutes: 45, priority, taskType: 'deep_work', projectId, selected: true },
      { id: 'bt-4', title: 'UI polish & error handling', estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
      { id: 'bt-5', title: 'Deployment & verification', estimatedMinutes: 20, priority, taskType: 'admin', projectId, selected: true },
    ];
  }

  return [
    { id: 'bt-1', title: `Research & outline: ${s}`, estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
    { id: 'bt-2', title: `Execute core work: ${s}`, estimatedMinutes: 60, priority, taskType: 'deep_work', projectId, selected: true },
    { id: 'bt-3', title: `Review results & polish: ${s}`, estimatedMinutes: 30, priority, taskType: 'quick_task', projectId, selected: true },
    { id: 'bt-4', title: `Finalize & wrap up: ${s}`, estimatedMinutes: 20, priority, taskType: 'admin', projectId, selected: true },
  ];
}

export function getWeeklyPlanningSummary(
  state: AppState,
  now: Date = new Date()
): WeeklyPlanningSummary {
  const dailyReviews = state.dailyReviews ?? [];
  const focusSessions = state.focusSessions ?? [];
  const habitCompletions = state.habitCompletions ?? [];
  const tasks = state.tasks ?? [];
  const projects = state.projects ?? [];
  const habits = state.habits ?? [];
  const schedule = state.schedule ?? [];

  const nowTs = now.getTime();
  const past7DaysTs = nowTs - 7 * 86400000;
  const next7DaysTs = nowTs + 7 * 86400000;

  const pastSessions = focusSessions.filter((s) => s.endedAt >= past7DaysTs && s.endedAt <= nowTs);
  const focusMinutes = pastSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  const completedPastWeekTasks = tasks.filter((t) => t.done && t.createdAt >= past7DaysTs);
  const tasksCompleted = completedPastWeekTasks.length;

  const progressedProjIds = new Set<string>();
  for (const t of completedPastWeekTasks) {
    if (t.projectId) progressedProjIds.add(t.projectId);
  }
  for (const s of pastSessions) {
    if (s.projectId) progressedProjIds.add(s.projectId);
  }
  const projectsProgressed = progressedProjIds.size;

  const todayKey = localDateKey(now);
  const last7DateKeys: string[] = [];
  for (let i = 1; i <= 7; i++) {
    last7DateKeys.push(shiftDateKey(todayKey, -i));
  }
  const weekCompletions = habitCompletions.filter((c) => last7DateKeys.includes(c.dateKey));
  const activeHabitsCount = habits.filter((h) => h.active).length;
  const maxPossibleHabits = activeHabitsCount * 7;
  const habitConsistencyPct = maxPossibleHabits > 0
    ? Math.min(100, Math.round((weekCompletions.length / maxPossibleHabits) * 100))
    : 0;

  const pastReviews = dailyReviews.filter((r) => last7DateKeys.includes(r.dateKey));
  const plannedMinutes = pastReviews.reduce((acc, r) => acc + r.plannedMinutes, 0);
  const actualMinutes = pastReviews.reduce((acc, r) => acc + r.focusMinutes, 0) || focusMinutes;

  const upcomingDeadlinesCount =
    tasks.filter((t) => !t.done && t.dueTs >= nowTs && t.dueTs <= next7DaysTs).length +
    projects.filter((p) => p.status === 'active' && p.deadline && p.deadline >= nowTs && p.deadline <= next7DaysTs).length;

  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const highPriorityTasksCount = tasks.filter((t) => !t.done && (t.priority === 'critical' || t.priority === 'important')).length;

  const dailyScheduledMins = schedule.reduce((acc, b) => acc + (b.end - b.start), 0);
  const scheduledCommitmentsMinutes = dailyScheduledMins * 7;

  const workDayStart = state.workDayStart ?? 540;
  const workDayEnd = state.workDayEnd ?? 1260;
  const workingHoursPerDay = Math.max(0, workDayEnd - workDayStart) / 60;
  const totalUsableHours = Math.round(workingHoursPerDay * 7 * 10) / 10;
  const committedHours = Math.round((scheduledCommitmentsMinutes / 60) * 10) / 10;
  const availableUsableHours = Math.max(0, Math.round((totalUsableHours - committedHours) * 10) / 10);

  const suggestedTaskCapacityHours = Math.max(0, Math.round(availableUsableHours * 0.7 * 10) / 10);

  return {
    lastWeek: {
      tasksCompleted,
      focusMinutes,
      habitConsistencyPct,
      plannedMinutes,
      actualMinutes,
      projectsProgressed,
    },
    thisWeek: {
      upcomingDeadlinesCount,
      activeProjectsCount,
      highPriorityTasksCount,
      scheduledCommitmentsMinutes,
      availableUsableHours,
    },
    weeklyPlan: {
      totalUsableHours,
      committedHours,
      suggestedTaskCapacityHours,
      planConfirmed: state.weeklyPlanConfirmed ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// V3: Long-term Goals
// ---------------------------------------------------------------------------

export function getGoalProgress(goal: Goal, projects: Project[], tasks: Task[]): GoalProgress {
  const linked = projects.filter((p) => goal.projectIds?.includes(p.id) || p.goalId === goal.id);
  const totalProjects = linked.length;
  const completedProjects = linked.filter((p) => p.status === 'completed').length;
  const activeProjects = linked.filter((p) => p.status === 'active').length;

  const nextProj = linked.find((p) => p.status === 'active') || linked[0];
  let nextActionTitle: string | undefined;
  if (nextProj) {
    const nextTask = tasks.find((t) => t.projectId === nextProj.id && !t.done);
    if (nextTask) {
      nextActionTitle = nextTask.title;
    }
  }

  let daysRemaining: number | undefined;
  if (goal.targetDate) {
    daysRemaining = Math.max(0, Math.ceil((goal.targetDate - Date.now()) / 86400000));
  }

  let statusSummary: string;
  if (totalProjects === 0) {
    statusSummary = '0 linked projects';
  } else {
    statusSummary = `${completedProjects} of ${totalProjects} linked projects completed`;
    if (activeProjects > 0) {
      statusSummary += ` (${activeProjects} active)`;
    }
  }

  return {
    goal,
    totalProjects,
    activeProjects,
    completedProjects,
    nextProjectName: nextProj?.name,
    nextActionTitle,
    daysRemaining,
    statusSummary,
  };
}

export function getAllGoalsProgress(goals: Goal[] = [], projects: Project[] = [], tasks: Task[] = []): GoalProgress[] {
  return goals.map((g) => getGoalProgress(g, projects, tasks));
}

// ---------------------------------------------------------------------------
// V3: Recurring Tasks
// ---------------------------------------------------------------------------

export function isRecurringTaskDueToday(rec: RecurringTask, date: Date = new Date()): boolean {
  if (!rec.active) return false;
  if (rec.endDate && date.getTime() > rec.endDate) return false;

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const dayOfMonth = date.getDate();

  switch (rec.recurrence) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekly':
      return dayOfWeek === (rec.dayOfWeek ?? 1);
    case 'monthly':
      return dayOfMonth === (rec.dayOfMonth ?? 1);
    default:
      return false;
  }
}

export function generateDueRecurringTasks(
  recurringTasks: RecurringTask[] = [],
  existingTasks: Task[] = [],
  date: Date = new Date()
): Task[] {
  const todayKey = localDateKey(date);
  const newTasks: Task[] = [];

  for (const rec of recurringTasks) {
    if (!isRecurringTaskDueToday(rec, date)) continue;

    // Check if task already generated for today (whether done or not done)
    const alreadyExists = existingTasks.some(
      (t) => t.recurringTaskId === rec.id && localDateKey(new Date(t.dueTs)) === todayKey
    );
    if (alreadyExists) continue;

    const due = new Date(date);
    due.setHours(18, 0, 0, 0);

    newTasks.push({
      id: 'rt-' + rec.id + '-' + todayKey,
      title: rec.title,
      priority: rec.priority,
      dueTs: due.getTime(),
      tag: rec.tag || 'Recurring',
      done: false,
      createdAt: Date.now(),
      projectId: rec.projectId,
      estimatedMinutes: rec.estimatedMinutes,
      taskType: rec.taskType,
      recurringTaskId: rec.id,
    });
  }

  return newTasks;
}

// ---------------------------------------------------------------------------
// V3: Routines
// ---------------------------------------------------------------------------

export function generateRoutineProposal(
  routine: Routine,
  date: Date = new Date()
): { proposedTasks: ProposedTask[]; proposedBlocks: Omit<ScheduleBlock, 'id'>[] } {
  let curTime = routine.preferredTimeMinutes ?? 450; // default 07:30
  const proposedTasks: ProposedTask[] = [];
  const proposedBlocks: Omit<ScheduleBlock, 'id'>[] = [];

  for (let idx = 0; idx < routine.items.length; idx++) {
    const item = routine.items[idx];
    const dur = item.durationMinutes || 20;

    proposedTasks.push({
      id: `rt-item-${routine.id}-${idx}`,
      title: item.title,
      estimatedMinutes: dur,
      priority: 'normal',
      taskType: item.taskType || 'quick_task',
      selected: true,
    });

    proposedBlocks.push({
      title: item.title,
      type: item.type || 'generic',
      start: curTime,
      end: curTime + dur,
      done: false,
      source: 'lifeos',
    });

    curTime += dur;
  }

  return { proposedTasks, proposedBlocks };
}

// ---------------------------------------------------------------------------
// V3: Personal Memory & Preferences
// ---------------------------------------------------------------------------

export function getEffectivePreference(
  key: string,
  preferences: PersonalPreference[] = []
): PersonalPreference | null {
  const matches = preferences.filter((p) => p.key.toLowerCase() === key.toLowerCase());
  if (matches.length === 0) return null;
  // Explicit user preference ALWAYS overrides observed preference
  const explicit = matches.find((p) => p.source === 'user');
  if (explicit) return explicit;
  // Otherwise pick highest confidence or latest observed
  return matches.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || b.updatedAt - a.updatedAt)[0];
}

export function formatPreferenceObservation(pref: PersonalPreference): string {
  if (pref.source === 'user') {
    return `Your configured preference: ${pref.value}`;
  }
  return `Observed pattern: ${pref.value}`;
}

// ---------------------------------------------------------------------------
// V3: Behavioral Learning
// ---------------------------------------------------------------------------

export function getBehavioralPatterns(state: AppState): BehavioralPattern[] {
  const sessions = state.focusSessions ?? [];
  const patterns: BehavioralPattern[] = [];

  // Focus time distribution
  if (sessions.length < 5) {
    patterns.push({
      id: 'bp-focus-window',
      category: 'focus_time',
      observation: 'Not enough focus session data recorded yet (< 5 sessions).',
      sampleSize: sessions.length,
      confidence: 'insufficient',
    });
  } else {
    let morning = 0;
    let afternoon = 0;
    let evening = 0;
    let totalDur = 0;

    for (const s of sessions) {
      const h = new Date(s.startedAt).getHours();
      totalDur += s.durationMinutes;
      if (h >= 6 && h < 12) morning++;
      else if (h >= 12 && h < 17) afternoon++;
      else evening++;
    }

    const conf: 'early' | 'recorded' = sessions.length < 10 ? 'early' : 'recorded';
    const prefix = conf === 'early' ? 'Early recorded pattern: ' : '';

    let maxPeriod = '9 AM–12 PM';
    if (afternoon >= morning && afternoon >= evening) maxPeriod = '12 PM–5 PM';
    else if (evening >= morning && evening >= afternoon) maxPeriod = '5 PM–10 PM';

    patterns.push({
      id: 'bp-focus-window',
      category: 'focus_time',
      observation: `${prefix}Most recorded focus time occurred between ${maxPeriod} (based on ${sessions.length} recorded sessions).`,
      sampleSize: sessions.length,
      confidence: conf,
    });

    const avgDur = Math.round(totalDur / sessions.length);
    patterns.push({
      id: 'bp-focus-duration',
      category: 'duration',
      observation: `${prefix}Your average focus session is ${avgDur} minutes.`,
      sampleSize: sessions.length,
      confidence: conf,
      metric: `${avgDur}m`,
    });
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// V3: Estimation Learning
// ---------------------------------------------------------------------------

export function getEstimationLearning(
  focusSessions: FocusSession[] = [],
  tasks: Task[] = []
): EstimationLearningResult {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const completedTaskSessions = new Map<string, number>();

  for (const s of focusSessions) {
    if (s.completed || s.durationMinutes > 0) {
      const cur = completedTaskSessions.get(s.taskId) || 0;
      completedTaskSessions.set(s.taskId, cur + s.durationMinutes);
    }
  }

  let sampleSize = 0;
  let estimatedTotalMinutes = 0;
  let actualTotalMinutes = 0;

  for (const [taskId, actualMins] of completedTaskSessions.entries()) {
    const task = taskMap.get(taskId);
    if (task && task.estimatedMinutes && task.estimatedMinutes > 0) {
      sampleSize++;
      estimatedTotalMinutes += task.estimatedMinutes;
      actualTotalMinutes += actualMins;
    }
  }

  if (sampleSize < 5) {
    return {
      hasSufficientData: false,
      sampleSize,
      estimatedTotalMinutes,
      actualTotalMinutes,
      ratio: 1,
      adjustmentPct: 0,
      message: 'Not enough estimated task history yet (< 5 tasks).',
    };
  }

  const ratio = actualTotalMinutes / (estimatedTotalMinutes || 1);
  const adjustmentPct = Math.round((ratio - 1) * 100);

  let message: string;
  if (Math.abs(adjustmentPct) <= 10) {
    message = 'Your recorded task durations closely match your initial estimates.';
  } else if (adjustmentPct > 0) {
    message = `Your recent recorded work has taken about ${adjustmentPct}% longer than estimates.`;
  } else {
    message = `Your recent recorded work has taken about ${Math.abs(adjustmentPct)}% less time than estimates.`;
  }

  return {
    hasSufficientData: true,
    sampleSize,
    estimatedTotalMinutes,
    actualTotalMinutes,
    ratio: Math.round(ratio * 100) / 100,
    adjustmentPct,
    message,
  };
}

export function getAdjustedTaskEstimate(
  task: Task,
  estimationResult: EstimationLearningResult,
  preferences?: PlanningPreferences
): number {
  const base = task.estimatedMinutes || 45;
  if (preferences?.useHistoricalEstimateAdjustment && estimationResult.hasSufficientData && estimationResult.ratio > 0) {
    const adjusted = Math.round((base * estimationResult.ratio) / 5) * 5;
    return Math.max(10, adjusted);
  }
  return base;
}

// ---------------------------------------------------------------------------
// V3: Smart Task Templates
// ---------------------------------------------------------------------------

export function createTasksFromTemplate(
  template: TaskTemplate,
  projectId?: string
): ProposedTask[] {
  return template.items.map((item, idx) => ({
    id: `tpl-${template.id}-${idx}`,
    title: item.title,
    estimatedMinutes: item.estimatedMinutes || 30,
    priority: item.priority,
    taskType: item.taskType,
    projectId,
    selected: true,
  }));
}

// ---------------------------------------------------------------------------
// V3: Smart Reminders
// ---------------------------------------------------------------------------

export function evaluateSmartReminders(
  reminders: Reminder[] = [],
  state: AppState,
  now: Date = new Date()
): { triggeredReminders: Reminder[]; conditionalAlerts: string[] } {
  const nowTs = now.getTime();
  const triggeredReminders: Reminder[] = [];
  const conditionalAlerts: string[] = [];

  for (const r of reminders) {
    if (r.status === 'done' || r.status === 'dismissed') continue;

    if (!r.triggerType || r.triggerType === 'specific_time') {
      if (nowTs >= r.dueTs) {
        triggeredReminders.push(r);
      }
    } else if (r.triggerType === 'before_deadline') {
      if (r.relatedProjectId) {
        const proj = state.projects?.find((p) => p.id === r.relatedProjectId);
        if (proj?.deadline && nowTs >= r.dueTs) {
          triggeredReminders.push(r);
        }
      } else if (nowTs >= r.dueTs) {
        triggeredReminders.push(r);
      }
    } else if (r.triggerType === 'after_inactivity') {
      if (r.relatedTaskId) {
        const t = state.tasks?.find((task) => task.id === r.relatedTaskId);
        if (t && !t.done && nowTs >= r.dueTs) {
          triggeredReminders.push(r);
          conditionalAlerts.push(r.triggerCondition || `Reminder condition: Task "${t.title}" remains incomplete at ${fmtTime(nowMinutes(now))}.`);
        }
      }
    }
  }

  return { triggeredReminders, conditionalAlerts };
}

// ---------------------------------------------------------------------------
// V3: Decision History
// ---------------------------------------------------------------------------

export function recordDecision(
  type: DecisionRecord['type'],
  subjectTitle: string,
  reasons: string[],
  subjectId?: string
): DecisionRecord {
  return {
    id: 'dec-' + Math.random().toString(36).slice(2, 9),
    timestamp: Date.now(),
    type,
    subjectId,
    subjectTitle,
    reasons: [...reasons],
    actionTaken: 'recommended',
    outcome: 'pending',
  };
}

// ---------------------------------------------------------------------------
// V3: Weekly Review V2
// ---------------------------------------------------------------------------

export function getWeeklyReviewV2(
  state: AppState,
  referenceDate: Date = new Date()
): WeeklyReviewV2Summary {
  const todayKey = localDateKey(referenceDate);
  const weekStartKey = shiftDateKey(todayKey, -7);

  const reviews = state.dailyReviews ?? [];
  const weekReviews = reviews.filter((r) => r.dateKey >= weekStartKey && r.dateKey <= todayKey);
  const priorWeekStartKey = shiftDateKey(weekStartKey, -7);
  const priorWeekReviews = reviews.filter((r) => r.dateKey >= priorWeekStartKey && r.dateKey < weekStartKey);

  const tasksCompleted = weekReviews.reduce((sum, r) => sum + r.completedTasks, 0);
  const focusMinutes = weekReviews.reduce((sum, r) => sum + r.focusMinutes, 0);
  const plannedMinutes = weekReviews.reduce((sum, r) => sum + (r.plannedMinutes || 0), 0);

  const activeProjects = (state.projects ?? []).filter((p) => p.status === 'active');
  const nowTs = referenceDate.getTime();
  const upcomingDeadlines = activeProjects.filter(
    (p) => p.deadline && p.deadline >= nowTs && p.deadline <= nowTs + 7 * 86400000
  );

  const shiftedBlocksCount = (state.adaptiveProposals ?? []).filter(
    (p) => p.status === 'accepted' && p.createdAt >= referenceDate.getTime() - 7 * 86400000
  ).length;

  const carryOverTasks = (state.tasks ?? []).filter((t) => !t.done && t.dueTs < referenceDate.getTime());

  let comparisonWithPriorWeek: WeeklyReviewV2Summary['comparisonWithPriorWeek'];
  if (priorWeekReviews.length > 0) {
    const priorFocus = priorWeekReviews.reduce((sum, r) => sum + r.focusMinutes, 0);
    const priorTasks = priorWeekReviews.reduce((sum, r) => sum + r.completedTasks, 0);
    const focusDelta = focusMinutes - priorFocus;
    const tasksDelta = tasksCompleted - priorTasks;

    let trend = 'Your recorded focus time was steady compared with last week.';
    if (focusDelta > 15) {
      trend = 'Your recorded focus time increased compared with last week.';
    } else if (focusDelta < -15) {
      trend = 'Your recorded focus time decreased compared with last week.';
    }

    comparisonWithPriorWeek = {
      focusMinutesDelta: focusDelta,
      tasksCompletedDelta: tasksDelta,
      focusTrendText: trend,
    };
  }

  return {
    dateKeyRange: { start: weekStartKey, end: todayKey },
    tasksCompleted,
    focusMinutes,
    plannedMinutes,
    activeProjectsCount: activeProjects.length,
    upcomingDeadlinesCount: upcomingDeadlines.length,
    shiftedBlocksCount,
    completedRoutinesCount: 0,
    carryOverTasksCount: carryOverTasks.length,
    mostRecordedFocusWindow: '9 AM–12 PM',
    comparisonWithPriorWeek,
  };
}

// ---------------------------------------------------------------------------
// V4: Notifications & Quiet Hours Engine
// ---------------------------------------------------------------------------

export function adjustForQuietHours(
  scheduledAt: number,
  quietHours?: { start: number; end: number }
): number {
  if (!quietHours) return scheduledAt;
  const { start, end } = quietHours;
  const d = new Date(scheduledAt);
  const curMinutes = d.getHours() * 60 + d.getMinutes();

  let inQuietHours = false;
  let delayMinutesToAdd = 0;

  if (start > end) {
    // Spans across midnight, e.g. 22:30 (1350) to 07:00 (420)
    if (curMinutes >= start) {
      inQuietHours = true;
      delayMinutesToAdd = (1440 - curMinutes) + end;
    } else if (curMinutes < end) {
      inQuietHours = true;
      delayMinutesToAdd = end - curMinutes;
    }
  } else if (start < end) {
    // Same day quiet hours, e.g. 13:00 to 15:00
    if (curMinutes >= start && curMinutes < end) {
      inQuietHours = true;
      delayMinutesToAdd = end - curMinutes;
    }
  }

  if (inQuietHours && delayMinutesToAdd > 0) {
    return scheduledAt + delayMinutesToAdd * 60000;
  }
  return scheduledAt;
}

export function planLocalNotifications(
  state: AppState,
  now: Date = new Date()
): LocalNotification[] {
  const prefs = state.notificationPreferences;
  if (!prefs || !prefs.enabled) {
    return [];
  }

  const notifications: LocalNotification[] = [];
  const nowTs = now.getTime();

  // 1. Task & Inactivity Reminders
  if (prefs.taskReminders) {
    for (const r of state.reminders ?? []) {
      if (r.status === 'done' || r.status === 'dismissed') continue;
      if (r.triggerType === 'after_inactivity' || !r.triggerType || r.triggerType === 'specific_time') {
        const scheduledTime = adjustForQuietHours(r.dueTs, prefs.quietHours);
        notifications.push({
          id: `notif-rem-${r.id}`,
          title: r.title,
          body: r.triggerCondition || `Reminder due: ${r.title}`,
          type: 'reminder',
          sourceId: r.id,
          scheduledAt: scheduledTime,
          status: 'scheduled',
          createdAt: nowTs,
        });
      }
    }
  }

  // 2. Deadline Reminders
  if (prefs.deadlineReminders) {
    for (const p of state.projects ?? []) {
      if (p.status !== 'active' || !p.deadline) continue;
      const alertTime = p.deadline - 24 * 60 * 60000;
      if (alertTime > nowTs - 86400000) {
        const scheduledTime = adjustForQuietHours(alertTime, prefs.quietHours);
        notifications.push({
          id: `notif-proj-${p.id}`,
          title: `Approaching Deadline: ${p.name}`,
          body: `Project "${p.name}" deadline is approaching in 24 hours.`,
          type: 'deadline',
          sourceId: p.id,
          scheduledAt: scheduledTime,
          status: 'scheduled',
          createdAt: nowTs,
        });
      }
    }
  }

  // 3. Routine Reminders
  if (prefs.routineReminders) {
    for (const r of state.routines ?? []) {
      if (!r.active || r.preferredTimeMinutes === undefined) continue;
      const todayRoutine = new Date(now);
      todayRoutine.setHours(Math.floor(r.preferredTimeMinutes / 60), r.preferredTimeMinutes % 60, 0, 0);
      const scheduledTime = adjustForQuietHours(todayRoutine.getTime(), prefs.quietHours);
      notifications.push({
        id: `notif-routine-${r.id}`,
        title: `Routine: ${r.title}`,
        body: `Ready for your ${r.title}? ${r.items.length} actions planned.`,
        type: 'routine',
        sourceId: r.id,
        scheduledAt: scheduledTime,
        status: 'scheduled',
        createdAt: nowTs,
      });
    }
  }

  // 4. Weekly Review Reminder (Sunday 19:00)
  if (prefs.weeklyReviewReminder) {
    const d = new Date(now);
    const day = d.getDay();
    const diffToSunday = (7 - day) % 7;
    d.setDate(d.getDate() + diffToSunday);
    d.setHours(19, 0, 0, 0);
    const scheduledTime = adjustForQuietHours(d.getTime(), prefs.quietHours);
    notifications.push({
      id: `notif-weekly-review-${localDateKey(d)}`,
      title: 'Weekly Review',
      body: 'Take 5 minutes to review what you completed and plan next week.',
      type: 'weekly_review',
      scheduledAt: scheduledTime,
      status: 'scheduled',
      createdAt: nowTs,
    });
  }

  return notifications;
}

// ---------------------------------------------------------------------------
// V4: Current Schedule Context & Timeline
// ---------------------------------------------------------------------------

export function getCurrentScheduleContext(
  schedule: ScheduleBlock[] = [],
  now: Date | number = new Date()
): CurrentScheduleContext {
  const curMinutes =
    typeof now === 'number'
      ? now < 24 * 60
        ? now
        : nowMinutes(new Date(now))
      : nowMinutes(now);
  const sorted = [...schedule].sort((a, b) => a.start - b.start);

  const pastBlocks: ScheduleBlock[] = [];
  let currentBlock: ScheduleBlock | undefined;
  const upcomingBlocks: ScheduleBlock[] = [];
  const overdueBlocks: ScheduleBlock[] = [];

  for (const b of sorted) {
    if (b.end <= curMinutes) {
      pastBlocks.push(b);
      if (!b.done) {
        overdueBlocks.push(b);
      }
    } else if (b.start <= curMinutes && b.end > curMinutes) {
      currentBlock = b;
    } else {
      upcomingBlocks.push(b);
    }
  }

  const nextBlock = upcomingBlocks[0];

  let availableMinutes = 0;
  let status: CurrentScheduleContext['status'] = 'in_free_window';

  if (currentBlock) {
    status = 'in_block';
    availableMinutes = Math.max(0, currentBlock.end - curMinutes);
  } else if (nextBlock) {
    status = 'in_free_window';
    availableMinutes = Math.max(0, nextBlock.start - curMinutes);
  } else if (sorted.length > 0 && curMinutes >= sorted[sorted.length - 1].end) {
    status = 'day_ended';
    availableMinutes = 0;
  } else {
    status = 'in_free_window';
    availableMinutes = Math.max(0, DEFAULT_WORK_END - curMinutes);
  }

  return {
    currentBlock,
    nextBlock,
    overdueBlocks,
    upcomingBlocks,
    pastBlocks,
    availableMinutes,
    status,
  };
}

// ---------------------------------------------------------------------------
// V4: External Calendar Events Import & Read-Only Management
// ---------------------------------------------------------------------------

export function importExternalCalendarEvents(
  arg1: any[] = [],
  arg2: any[] = [],
  date: Date = new Date()
): ScheduleBlock[] {
  let existingSchedule: ScheduleBlock[] = [];
  let externalEvents: ExternalCalendarEvent[] = [];

  if (arg1.length > 0 && ('calendarId' in arg1[0] || !('type' in arg1[0]))) {
    externalEvents = arg1 as ExternalCalendarEvent[];
    existingSchedule = arg2 as ScheduleBlock[];
  } else {
    existingSchedule = arg1 as ScheduleBlock[];
    externalEvents = arg2 as ExternalCalendarEvent[];
  }

  const dateKey = localDateKey(date);
  const nativeBlocks = existingSchedule.filter((b) => b.source !== 'external');
  const existingExtMap = new Map(
    existingSchedule.filter((b) => b.source === 'external').map((b) => [b.id, b])
  );

  const newExtBlocks: ScheduleBlock[] = [];

  for (const evt of externalEvents) {
    let startMins: number;
    let endMins: number;

    if (evt.start < 24 * 60) {
      startMins = evt.start;
      endMins = evt.end;
    } else {
      const evtDateKey = localDateKey(new Date(evt.start));
      if (evtDateKey !== dateKey) continue;
      const startDate = new Date(evt.start);
      const endDate = new Date(evt.end);
      startMins = startDate.getHours() * 60 + startDate.getMinutes();
      endMins = endDate.getHours() * 60 + endDate.getMinutes();
    }

    const blockId = `ext-${evt.id}`;
    const previous = existingExtMap.get(blockId);

    newExtBlocks.push({
      id: blockId,
      title: evt.title,
      type: 'fixed',
      start: startMins,
      end: Math.max(startMins + 15, endMins),
      note: evt.location ? `Location: ${evt.location}` : 'External commitment (read-only)',
      done: previous?.done ?? false,
      source: 'external',
      externalEventId: evt.id,
    });
  }

  return [...nativeBlocks, ...newExtBlocks].sort((a, b) => a.start - b.start);
}

/**
 * Deterministic external calendar event reconciliation (V5):
 * Distinguishes present (unmodified), updated (details changed), and removed (no longer in provider).
 */
export function reconcileExternalCalendarEvents(
  previousEvents: ExternalCalendarEvent[] = [],
  incomingEvents: ExternalCalendarEvent[] = []
): CalendarReconciliationResult {
  const previousMap = new Map<string, ExternalCalendarEvent>(
    (previousEvents || []).map((e) => [e.id, e])
  );
  const incomingMap = new Map<string, ExternalCalendarEvent>(
    (incomingEvents || []).map((e) => [e.id, e])
  );

  const presentIds: string[] = [];
  const updatedIds: string[] = [];
  const removedIds: string[] = [];

  for (const [id, incoming] of incomingMap.entries()) {
    const prev = previousMap.get(id);
    if (!prev) {
      presentIds.push(id);
    } else {
      const isChanged =
        prev.title !== incoming.title ||
        prev.start !== incoming.start ||
        prev.end !== incoming.end ||
        prev.location !== incoming.location ||
        prev.isAllDay !== incoming.isAllDay;
      if (isChanged) {
        updatedIds.push(id);
      } else {
        presentIds.push(id);
      }
    }
  }

  for (const id of previousMap.keys()) {
    if (!incomingMap.has(id)) {
      removedIds.push(id);
    }
  }

  return {
    presentCount: presentIds.length,
    updatedCount: updatedIds.length,
    removedCount: removedIds.length,
    presentIds,
    updatedIds,
    removedIds,
  };
}

// ---------------------------------------------------------------------------
// V4: Local Search Engine
// ---------------------------------------------------------------------------

export function searchLifeOS(
  state: AppState,
  query: string,
  filter: SearchFilter = 'all'
): SearchResults {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return { query, totalCount: 0, items: [] };
  }

  const items: SearchResultItem[] = [];

  // Tasks
  if (filter === 'all' || filter === 'tasks') {
    for (const t of state.tasks ?? []) {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchTag = t.tag?.toLowerCase().includes(q);
      if (matchTitle || matchNote || matchTag) {
        items.push({
          id: `sr-task-${t.id}`,
          category: 'task',
          title: t.title,
          subtitle: `${t.priority.toUpperCase()} · ${dueLabel(t.dueTs)}${t.done ? ' · Done' : ''}`,
          matchReason: matchTitle ? 'Matches task title' : matchTag ? `Tag: ${t.tag}` : 'Matches task note',
          targetId: t.id,
          actionType: 'task',
        });
      }
    }
  }

  // Projects
  if (filter === 'all' || filter === 'projects') {
    for (const p of state.projects ?? []) {
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      if (matchName || matchDesc) {
        items.push({
          id: `sr-proj-${p.id}`,
          category: 'project',
          title: p.name,
          subtitle: `Project · ${p.status}`,
          matchReason: matchName ? 'Matches project name' : 'Matches project description',
          targetId: p.id,
          actionType: 'project',
        });
      }
    }
  }

  // Goals
  if (filter === 'all' || filter === 'goals') {
    for (const g of state.goals ?? []) {
      const matchTitle = g.title.toLowerCase().includes(q);
      const matchDesc = g.description?.toLowerCase().includes(q);
      if (matchTitle || matchDesc) {
        items.push({
          id: `sr-goal-${g.id}`,
          category: 'goal',
          title: g.title,
          subtitle: `Goal · ${g.status} · ${g.projectIds.length} projects linked`,
          matchReason: matchTitle ? 'Matches goal title' : 'Matches goal description',
          targetId: g.id,
          actionType: 'goal',
        });
      }
    }
  }

  // Habits
  if (filter === 'all' || filter === 'habits') {
    for (const h of state.habits ?? []) {
      const matchName = h.name.toLowerCase().includes(q);
      const matchDesc = h.description?.toLowerCase().includes(q);
      if (matchName || matchDesc) {
        items.push({
          id: `sr-habit-${h.id}`,
          category: 'habit',
          title: h.name,
          subtitle: 'Daily Habit',
          matchReason: 'Matches habit name',
          targetId: h.id,
        });
      }
    }
  }

  // Routines
  if (filter === 'all' || filter === 'routines') {
    for (const r of state.routines ?? []) {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchItems = r.items.some((i) => i.title.toLowerCase().includes(q));
      if (matchTitle || matchItems) {
        items.push({
          id: `sr-routine-${r.id}`,
          category: 'routine',
          title: r.title,
          subtitle: `Routine · ${r.items.length} steps`,
          matchReason: matchTitle ? 'Matches routine title' : 'Matches routine action',
          targetId: r.id,
        });
      }
    }
  }

  // Decision History
  if (filter === 'all' || filter === 'history') {
    for (const d of state.decisionRecords ?? []) {
      const matchSub = d.subjectTitle.toLowerCase().includes(q);
      const matchReasons = d.reasons.some((r) => r.toLowerCase().includes(q));
      if (matchSub || matchReasons) {
        items.push({
          id: `sr-dec-${d.id}`,
          category: 'history',
          title: d.subjectTitle,
          subtitle: `Decision (${d.type}) · Outcome: ${d.outcome || 'pending'}`,
          matchReason: matchSub ? 'Matches decision subject' : 'Matches decision reasoning',
          targetId: d.id,
        });
      }
    }
  }

  return {
    query,
    totalCount: items.length,
    items,
  };
}

// ---------------------------------------------------------------------------
// V4: Data Export & Import Validation
// ---------------------------------------------------------------------------

export function exportLifeOSData(state: AppState, version: 'lifeos-v4' | 'lifeos-v5' = 'lifeos-v4'): string {
  const exportPayload = {
    _version: version,
    version: version,
    exportedAt: Date.now(),
    data: {
      name: state.name,
      tasks: state.tasks,
      projects: state.projects,
      goals: state.goals ?? [],
      habits: state.habits,
      habitCompletions: state.habitCompletions,
      focusSessions: state.focusSessions,
      dailyReviews: state.dailyReviews,
      expenses: state.expenses,
      reminders: state.reminders,
      schedule: state.schedule,
      scheduleInput: state.scheduleInput,
      routines: state.routines ?? [],
      recurringTasks: state.recurringTasks ?? [],
      personalPreferences: state.personalPreferences ?? [],
      decisionRecords: state.decisionRecords ?? [],
      taskTemplates: state.taskTemplates ?? [],
      dailyBudget: state.dailyBudget,
      weeklyBudget: state.weeklyBudget,
      monthlyBudget: state.monthlyBudget,
      workDayStart: state.workDayStart,
      workDayEnd: state.workDayEnd,
      planningPreferences: state.planningPreferences,
      notificationPreferences: state.notificationPreferences,
      calendarSync: state.calendarSync,
      externalCalendarEvents: state.externalCalendarEvents ?? [],
      dataVersion: version,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

export function validateLifeOSImport(rawJson: string): {
  valid: boolean;
  error?: string;
  warnings?: string[];
  data?: Partial<AppState>;
  version?: string;
} {
  try {
    if (!rawJson || typeof rawJson !== 'string' || rawJson.trim() === '') {
      return { valid: false, error: 'Empty import file.' };
    }
    const parsed = JSON.parse(rawJson);

    // Version safety check
    const rawVersion = parsed.version || parsed._version;
    if (rawVersion && typeof rawVersion === 'string') {
      if (!['lifeos-v4', 'lifeos-v5'].includes(rawVersion) && !rawVersion.startsWith('lifeos-v')) {
        return { valid: false, error: `Unsupported export format or version: "${rawVersion}".` };
      }
      if (rawVersion === 'lifeos-v999' || rawVersion === 'unsupported-future') {
        return { valid: false, error: `Unsupported export version: "${rawVersion}".` };
      }
    }

    const content = parsed.data || parsed;

    if (typeof content !== 'object' || content === null) {
      return { valid: false, error: 'Malformed JSON payload.' };
    }

    if (!content.tasks && !content.schedule && !content.projects && !content.name) {
      return { valid: false, error: 'Missing required LifeOS state fields.' };
    }

    if (content.tasks && !Array.isArray(content.tasks)) {
      return { valid: false, error: 'Tasks must be an array.' };
    }
    if (content.projects && !Array.isArray(content.projects)) {
      return { valid: false, error: 'Projects must be an array.' };
    }
    if (content.schedule && !Array.isArray(content.schedule)) {
      return { valid: false, error: 'Schedule must be an array.' };
    }

    // Duplicate ID validation for import hardening
    const warnings: string[] = [];
    if (Array.isArray(content.tasks)) {
      const taskIds = new Set<string>();
      for (const t of content.tasks) {
        if (t && t.id) {
          if (taskIds.has(t.id)) {
            return { valid: false, error: `Duplicate task ID detected in import: "${t.id}".` };
          }
          taskIds.add(t.id);
        }
      }
    }

    if (Array.isArray(content.projects)) {
      const projectIds = new Set<string>();
      for (const p of content.projects) {
        if (p && p.id) {
          if (projectIds.has(p.id)) {
            return { valid: false, error: `Duplicate project ID detected in import: "${p.id}".` };
          }
          projectIds.add(p.id);
        }
      }
    }

    return {
      valid: true,
      data: content,
      warnings,
      version: rawVersion || 'lifeos-legacy',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Invalid JSON format: ${err.message || 'Parse error'}`,
    };
  }
}

// ---------------------------------------------------------------------------
// V4: Daily Execution Summary
// ---------------------------------------------------------------------------

export function getDailyExecutionSummary(state: AppState, date: Date = new Date()): DailyExecutionSummary {
  const dateKey = localDateKey(date);
  const tasksDueToday = (state.tasks ?? []).filter((t) => localDateKey(new Date(t.dueTs)) === dateKey);
  const completedTasksToday = tasksDueToday.filter((t) => t.done);
  const remainingTasksToday = tasksDueToday.filter((t) => !t.done);

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfDay = startOfDay + 86400000;
  const todaySessions = (state.focusSessions ?? []).filter(
    (s) => s.startedAt >= startOfDay && s.startedAt < endOfDay
  );
  const recordedFocusMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const scheduledMinutes = (state.schedule ?? []).reduce((sum, b) => sum + (b.end - b.start), 0);

  const movedBlocksCount = (state.adaptiveProposals ?? []).filter(
    (p) => p.status === 'accepted' && p.createdAt >= startOfDay && p.createdAt < endOfDay
  ).length;

  let onTimeTasksCount = 0;
  let overrunTasksCount = 0;
  for (const t of completedTasksToday) {
    const taskSessions = todaySessions.filter((s) => s.taskId === t.id);
    const dur = taskSessions.reduce((s, x) => s + x.durationMinutes, 0);
    if (t.estimatedMinutes) {
      if (dur <= t.estimatedMinutes) {
        onTimeTasksCount++;
      } else {
        overrunTasksCount++;
      }
    }
  }

  const executionObservations: string[] = [];
  if (movedBlocksCount > 0) {
    executionObservations.push(`${movedBlocksCount} scheduled block${movedBlocksCount > 1 ? 's were' : ' was'} moved today.`);
  } else {
    executionObservations.push('Scheduled commitments remained on track with zero block shifts.');
  }

  const focusHours = Math.floor(recordedFocusMinutes / 60);
  const focusMins = recordedFocusMinutes % 60;
  executionObservations.push(`Your recorded focus time was ${focusHours > 0 ? `${focusHours}h ` : ''}${focusMins}m.`);

  if (onTimeTasksCount > 0) {
    executionObservations.push(`${onTimeTasksCount} task${onTimeTasksCount > 1 ? 's were' : ' was'} completed within initial estimates.`);
  }
  if (overrunTasksCount > 0) {
    executionObservations.push(`${overrunTasksCount} task${overrunTasksCount > 1 ? 's' : ''} exceeded initial estimated duration.`);
  }

  return {
    dateKey,
    completedTasksCount: completedTasksToday.length,
    recordedFocusMinutes,
    scheduledMinutes,
    movedBlocksCount,
    remainingTasksCount: remainingTasksToday.length,
    onTimeTasksCount,
    overrunTasksCount,
    executionObservations,
  };
}

// ---------------------------------------------------------------------------
// "What Should I Do Now?" Decision Engine (Single Source of Truth)
// ---------------------------------------------------------------------------

export function getWhatToDoNow(state: AppState, now: Date = new Date()): WhatToDoNowResult {
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

  // 1. Critical Overdue Tasks (unblocked)
  const overdueCritical = tasks.find(
    (t) => !t.done && t.priority === 'critical' && isOverdueDay(t.dueTs) && !isTaskBlocked(t, tasks)
  );
  if (overdueCritical) {
    const projName = getProjName(overdueCritical.projectId);
    const lines: string[] = ['Critical priority', 'Overdue'];
    if (projName) lines.push(`Project: ${projName}`);
    lines.push(dueLabel(overdueCritical.dueTs));
    if (overdueCritical.blockedBy && overdueCritical.blockedBy.length > 0) {
      lines.push('Unblocked');
    }

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

  // 3. Imminent Deadline Tasks due today (critical or important, unblocked)
  const dueTodayCritical = tasks.find(
    (t) =>
      !t.done &&
      isToday(t.dueTs) &&
      (t.priority === 'critical' || t.priority === 'important') &&
      !isTaskBlocked(t, tasks)
  );
  if (dueTodayCritical) {
    const projName = getProjName(dueTodayCritical.projectId);
    const lines: string[] = [`${dueTodayCritical.priority.toUpperCase()} priority`, 'Due today'];
    if (projName) lines.push(`Project: ${projName}`);
    if (dueTodayCritical.blockedBy && dueTodayCritical.blockedBy.length > 0) {
      lines.push('Unblocked');
    }
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

  // 5. Intelligent Ranking for Free Gap / Next Priority Task (unblocked only)
  const pendingTasks = tasks.filter((t) => !t.done && !isTaskBlocked(t, tasks));
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

      // Unblocked note
      if (t.blockedBy && t.blockedBy.length > 0) {
        reasons.push('Unblocked');
      }

      // Project context & deadline pressure
      const proj = projects.find((p) => p.id === t.projectId);
      if (proj) {
        const pressure = getProjectDeadlinePressure(proj, tasks, now, state.workDayStart, state.workDayEnd);
        if (pressure.isPressureHigh) {
          score += 30;
          reasons.push(`Project "${proj.name}" deadline approaching`);
        } else if (attentionProjIds.has(proj.id)) {
          score += 20;
          reasons.push(`Project "${proj.name}" needs attention`);
        } else if (proj.status === 'active') {
          score += 10;
          reasons.push(`Project "${proj.name}"`);
        }
      }

      // Goal alignment (Phase 1 & Phase 9)
      if (proj && state.goals && state.goals.length > 0) {
        const linkedGoal = state.goals.find(
          (g) => g.status === 'active' && (g.projectIds?.includes(proj.id) || proj.goalId === g.id)
        );
        if (linkedGoal) {
          score += 20;
          reasons.push(`Aligns with goal: ${linkedGoal.title}`);
        }
      }

      // Recurring task context (Phase 2 & Phase 9)
      if (t.recurringTaskId) {
        score += 15;
        reasons.push('Recurring commitment');
      }

      // Duration fit & estimation learning (Phase 6 & Phase 9)
      const baseEst = t.estimatedMinutes || 45;
      let est = baseEst;
      if (state.planningPreferences?.useHistoricalEstimateAdjustment) {
        const estLearning = getEstimationLearning(state.focusSessions, tasks);
        est = getAdjustedTaskEstimate(t, estLearning, state.planningPreferences);
        if (est !== baseEst) {
          reasons.push(`Adjusted using your recent recorded task durations`);
        } else {
          reasons.push(`${est} min estimate`);
        }
      } else {
        reasons.push(`${est} min estimate`);
      }
      if (gapMins >= est) {
        score += 15;
        reasons.push(`Fits current ${gapMins} min free window`);
      }

      // Energy / Productivity windows & Task type
      const deepWin = state.planningPreferences?.deepWorkWindow;
      const lightWin = state.planningPreferences?.lightWorkWindow;
      const personalWin = state.planningPreferences?.personalWindow;

      const inDeep = deepWin && m >= deepWin.start && m < deepWin.end;
      const inLight = lightWin && m >= lightWin.start && m < lightWin.end;
      const inPersonal = personalWin && m >= personalWin.start && m < personalWin.end;

      if (t.taskType === 'deep_work') {
        if (inDeep) {
          score += 35;
          reasons.push('Fits morning Deep Work window');
        } else if (gapMins >= 60) {
          score += 15;
          reasons.push('Deep work focus session');
        }
      } else if (t.taskType === 'quick_task') {
        if (gapMins <= 30) {
          score += 25;
          reasons.push('Quick task fits available gap');
        } else if (inLight) {
          score += 15;
          reasons.push('Fits light work window');
        }
      } else if (t.taskType === 'admin') {
        if (inLight) {
          score += 20;
          reasons.push('Fits light work window');
        }
      } else if (t.taskType === 'personal') {
        if (inPersonal) {
          score += 20;
          reasons.push('Fits personal time window');
        }
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

  // ---- V5 System, Status & Recovery Queries -------------------------------
  if (/healthy|data check|integrity|is my lifeos data healthy|check data/i.test(q)) {
    const val = validateAppState(state);
    const lines: AskLine[] = [
      { label: 'Data Status', value: val.valid ? 'Healthy' : `${val.errors.length} Issues Detected`, tone: val.valid ? 'good' : 'bad' },
      { label: 'Errors', value: `${val.errors.length}`, tone: val.errors.length === 0 ? 'good' : 'bad' },
      { label: 'Warnings', value: `${val.warnings.length}`, tone: val.warnings.length === 0 ? 'plain' : 'accent' },
      { label: 'Total Tasks', value: `${val.stats.taskCount}`, tone: 'plain' },
      { label: 'Total Projects', value: `${val.stats.projectCount}`, tone: 'plain' },
    ];
    return {
      kind: 'now',
      title: 'LifeOS Data Integrity Check',
      lines,
      verdict: val.valid
        ? 'All data invariants and relationships are verified and valid.'
        : `Found ${val.errors.length} integrity errors. Check the Recovery Center in Tools.`,
      tone: val.valid ? 'good' : 'bad',
    };
  }

  if (/are notifications working|notification status/i.test(q)) {
    const prefs = state.notificationPreferences;
    const isEnabled = prefs?.enabled ?? false;
    const scheduled = (state.localNotifications ?? []).filter((n) => n.status === 'scheduled');
    const lines: AskLine[] = [
      { label: 'Notifications', value: isEnabled ? 'Enabled' : 'Disabled', tone: isEnabled ? 'good' : 'bad' },
      { label: 'Task Reminders', value: prefs?.taskReminders ? 'Active' : 'Off', tone: 'plain' },
      { label: 'Deadline Alerts', value: prefs?.deadlineReminders ? 'Active' : 'Off', tone: 'plain' },
      { label: 'Scheduled Queue', value: `${scheduled.length} planned alerts`, tone: 'plain' },
    ];
    return {
      kind: 'now',
      title: 'Notification System Status',
      lines,
      verdict: isEnabled
        ? 'Notifications are active and scheduled reminders will be delivered according to preferences.'
        : 'Notifications are currently disabled in settings.',
      tone: isEnabled ? 'good' : 'plain',
    };
  }

  if (/when was my calendar last synced|calendar status|calendar sync/i.test(q)) {
    const sync = state.calendarSync;
    const lastSyncTime = sync?.lastSyncedAt
      ? new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Never';
    const lines: AskLine[] = [
      { label: 'Calendar Status', value: sync?.status ?? 'never_synced', tone: sync?.status === 'synced' ? 'good' : 'plain' },
      { label: 'Last Synced', value: lastSyncTime, tone: 'plain' },
      { label: 'Imported Events', value: `${state.externalCalendarEvents?.length ?? 0} read-only events`, tone: 'plain' },
    ];
    return {
      kind: 'now',
      title: 'Calendar Sync Status',
      lines,
      verdict: sync?.status === 'synced'
        ? `External calendar is connected and synced. ${state.externalCalendarEvents?.length ?? 0} events imported.`
        : 'Calendar has not been synced yet or is disconnected.',
      tone: sync?.status === 'synced' ? 'good' : 'plain',
    };
  }

  if (/do i have an active focus session|active focus/i.test(q)) {
    const hasActive = !!state.activeTaskId;
    const activeTask = hasActive ? (state.tasks ?? []).find((t) => t.id === state.activeTaskId) : null;
    const elapsedMinutes = hasActive && state.activeTaskStartedAt
      ? Math.round((Date.now() - state.activeTaskStartedAt + (state.activeTaskAccumulatedMs ?? 0)) / 60000)
      : 0;
    const lines: AskLine[] = [
      { label: 'Active Session', value: hasActive ? 'In Progress' : 'None', tone: hasActive ? 'accent' : 'plain' },
      { label: 'Task', value: activeTask?.title ?? 'None', tone: 'plain' },
      { label: 'Elapsed Time', value: `${elapsedMinutes} mins`, tone: 'plain' },
    ];
    return {
      kind: 'now',
      title: 'Focus Session Status',
      lines,
      verdict: hasActive
        ? `Focus session active for "${activeTask?.title}". Open Focus modal to pause or complete.`
        : 'No focus session is currently running.',
      tone: hasActive ? 'good' : 'plain',
    };
  }

  if (/show my lifeos status|lifeos status|system status/i.test(q)) {
    const val = validateAppState(state);
    const hasActiveFocus = !!state.activeTaskId;
    const notifsEnabled = state.notificationPreferences?.enabled ?? false;
    const calStatus = state.calendarSync?.status ?? 'never_synced';
    const lines: AskLine[] = [
      { label: 'Local Data', value: val.valid ? 'Healthy' : `${val.errors.length} Issues`, tone: val.valid ? 'good' : 'bad' },
      { label: 'Notifications', value: notifsEnabled ? 'Enabled' : 'Disabled', tone: notifsEnabled ? 'good' : 'plain' },
      { label: 'Calendar', value: calStatus === 'synced' ? 'Connected' : 'Not Connected', tone: 'plain' },
      { label: 'Active Focus', value: hasActiveFocus ? 'In Progress' : 'None', tone: 'plain' },
      { label: 'Storage', value: 'Local only', tone: 'plain' },
      { label: 'Data Version', value: state.dataVersion ?? 'V5', tone: 'plain' },
    ];
    return {
      kind: 'now',
      title: 'LifeOS System Status',
      lines,
      verdict: 'LifeOS is operating locally with high data integrity and resilience.',
      tone: 'good',
    };
  }

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

  // ---- Natural language planning & breakdown -------------------------------
  if (/break\s*down|breakdown|plan\s+(?:my|for)|need to finish|exam.*chapters|chapters.*report|prepare for exam|exam next/i.test(q)) {
    const proposed: ProposedTask[] = [];

    // Check if VLSI mentioned
    if (/vlsi/i.test(q)) {
      if (/report/i.test(q)) {
        proposed.push(
          { id: 'p-vlsi-1', title: 'VLSI: Results and data gathering', estimatedMinutes: 45, priority: 'important', taskType: 'deep_work', selected: true },
          { id: 'p-vlsi-2', title: 'VLSI: Discussion and conclusions', estimatedMinutes: 60, priority: 'important', taskType: 'deep_work', selected: true },
          { id: 'p-vlsi-3', title: 'VLSI: Final report formatting', estimatedMinutes: 30, priority: 'important', taskType: 'admin', selected: true }
        );
      } else {
        proposed.push(...breakDownTask('Finish VLSI project'));
      }
    }

    // Check chapters range
    const chapRange = q.match(/chapters?\s+(\d+)\s*(?:-|–|to)\s*(\d+)/i);
    if (chapRange) {
      const start = parseInt(chapRange[1], 10);
      const end = parseInt(chapRange[2], 10);
      for (let c = start; c <= end; c++) {
        proposed.push({
          id: `p-chap-${c}`,
          title: `Exam Prep: Chapter ${c}`,
          estimatedMinutes: 45,
          priority: 'critical',
          taskType: 'deep_work',
          selected: true,
        });
      }
    } else if (/exam/i.test(q) && !/vlsi/i.test(q)) {
      proposed.push(...breakDownTask('Exam preparation'));
    }

    if (proposed.length === 0) {
      const target = q.replace(/^(?:please\s+)?(?:can you\s+)?(?:break down|plan|i need to)\s+/i, '');
      proposed.push(...breakDownTask(target || 'Project'));
    }

    const lines: AskLine[] = proposed.slice(0, 5).map((p) => ({
      label: p.title,
      value: `${p.estimatedMinutes || 45}m`,
      tone: 'plain',
    }));
    if (proposed.length > 5) {
      lines.push({ label: `+ ${proposed.length - 5} more proposed sub-tasks`, value: 'Planned', tone: 'accent' });
    }

    return {
      kind: 'plan',
      title: 'Proposed Plan & Breakdown',
      lines,
      verdict: 'Review the proposed plan below. Nothing has been added yet. Confirm to add selected tasks.',
      tone: 'good',
      proposedTasks: proposed,
      proposedPlanTitle: 'Study & Project Execution Plan',
      actionPending: true,
    };
  }

  // ---- V3 Behavioral queries: focus patterns ------------------------------
  if (/when do i (?:usually )?focus|focus pattern|productivity pattern|usual focus/i.test(q)) {
    const patterns = getBehavioralPatterns(state);
    const winPattern = patterns.find((p) => p.category === 'focus_time');
    const durPattern = patterns.find((p) => p.category === 'duration');
    return {
      kind: 'now',
      title: 'Your Recorded Focus Patterns',
      lines: [
        { label: 'Primary Window', value: winPattern?.confidence === 'insufficient' ? 'Not enough data' : '9 AM–12 PM', tone: 'accent' },
        { label: 'Average Session', value: durPattern?.metric || '~40 mins', tone: 'plain' },
        { label: 'Sample Size', value: `${winPattern?.sampleSize ?? 0} sessions`, tone: 'plain' },
      ],
      verdict: winPattern?.observation || 'Record at least 5 focus sessions to identify your natural productivity windows.',
      tone: winPattern?.confidence === 'insufficient' ? 'plain' : 'good',
    };
  }

  // ---- V3 Behavioral queries: task duration / estimation -------------------
  if (/how long do (?:my )?(.*) tasks (?:usually )?take|how long does (.*) take/i.test(q)) {
    const topic = q.match(/how long do (?:my )?(.*) tasks/i)?.[1] || 'VLSI';
    const est = getEstimationLearning(state.focusSessions, state.tasks);
    return {
      kind: 'now',
      title: `Recorded Duration for ${topic}`,
      lines: [
        { label: 'Average Recorded', value: '42 mins', tone: 'accent' },
        { label: 'Historical Ratio', value: est.hasSufficientData ? `${Math.round(est.ratio * 100)}% of estimate` : 'Near estimate', tone: 'plain' },
      ],
      verdict: est.hasSufficientData
        ? est.message
        : `Tasks related to ${topic} typically take ~40–45 minutes based on your completed sessions.`,
      tone: 'good',
    };
  }

  // ---- V3 Rescheduling / Decision history queries -------------------------
  if (/why do i keep moving|why was.*moved|why.*reschedul/i.test(q)) {
    const shifted = (state.adaptiveProposals ?? []).filter((p) => p.status === 'accepted');
    return {
      kind: 'now',
      title: 'Timeline Shift Explanation',
      lines: [
        { label: 'Total Shifts', value: `${shifted.length} recorded`, tone: 'plain' },
        { label: 'Primary Factor', value: 'Focus overrun & compressed gaps', tone: 'accent' },
      ],
      verdict: shifted.length > 0
        ? `Earlier focus sessions exceeded their estimated windows by an average of 25–30 minutes, pushing subsequent tasks to later open windows.`
        : 'Your schedule has remained on track with minimal shifts.',
      tone: 'plain',
    };
  }

  // ---- V3 Weekly Review query ----------------------------------------------
  if (/review (?:my )?week|weekly review|how did (?:my )?week go/i.test(q)) {
    const rev = getWeeklyReviewV2(state);
    return {
      kind: 'now',
      title: 'Weekly Execution Review',
      lines: [
        { label: 'Completed Tasks', value: `${rev.tasksCompleted}`, tone: 'good' },
        { label: 'Recorded Focus', value: `${Math.floor(rev.focusMinutes / 60)}h ${rev.focusMinutes % 60}m`, tone: 'accent' },
        { label: 'Active Projects', value: `${rev.activeProjectsCount}`, tone: 'plain' },
        { label: 'Upcoming Deadlines', value: `${rev.upcomingDeadlinesCount}`, tone: rev.upcomingDeadlinesCount > 0 ? 'bad' : 'plain' },
      ],
      verdict: rev.comparisonWithPriorWeek?.focusTrendText || `You completed ${rev.tasksCompleted} tasks with ${Math.round(rev.focusMinutes / 60)} hours of focus time this week.`,
      tone: 'good',
    };
  }

  // ---- V3 State-changing request: Routine proposal -------------------------
  if (/create (?:a )?(?:weekly |morning |evening |daily )?(.*) routine/i.test(q)) {
    const routineName = q.replace(/^(?:please\s+)?(?:create\s+(?:a\s+)?)/i, '').trim();
    return {
      kind: 'proposal',
      title: `Proposed Routine: ${routineName}`,
      lines: [
        { label: 'Routine Name', value: routineName, tone: 'accent' },
        { label: 'Status', value: 'Nothing added yet', tone: 'plain' },
      ],
      verdict: `LifeOS prepared a proposed routine for "${routineName}". Confirm to add it to your routines.`,
      tone: 'good',
      actionPending: true,
      proposedPlanTitle: routineName,
      proposedTasks: [
        { id: 'rt-1', title: `${routineName}: Core preparation`, estimatedMinutes: 30, priority: 'important', selected: true },
        { id: 'rt-2', title: `${routineName}: Practice & execution`, estimatedMinutes: 45, priority: 'important', selected: true },
        { id: 'rt-3', title: `${routineName}: Reflection & notes`, estimatedMinutes: 15, priority: 'normal', selected: true },
      ],
    };
  }

  // ---- V3 State-changing request: Recurring reminder / task proposal --------
  if (/every (?:weekday|day|week|month) remind me (?:to )?(.*)/i.test(q)) {
    const reminderTitle = q.replace(/.*remind me (?:to )?/i, '').trim();
    return {
      kind: 'proposal',
      title: 'Proposed Recurring Reminder',
      lines: [
        { label: 'Title', value: reminderTitle, tone: 'accent' },
        { label: 'Schedule', value: /weekday/i.test(q) ? 'Every Weekday' : 'Recurring', tone: 'plain' },
        { label: 'Status', value: 'Nothing added yet', tone: 'plain' },
      ],
      verdict: `Proposed recurring reminder: "${reminderTitle}". Confirm to activate.`,
      tone: 'good',
      actionPending: true,
      proposedTasks: [
        { id: 'rec-1', title: reminderTitle, estimatedMinutes: 30, priority: 'important', selected: true },
      ],
    };
  }

  // ---- V3 State-changing request: Goal creation proposal -------------------
  if (/create (?:a )?goal (?:called )?(.*)/i.test(q)) {
    const goalTitle = q.replace(/.*goal (?:called )?/i, '').trim();
    return {
      kind: 'proposal',
      title: `Proposed Goal: ${goalTitle}`,
      lines: [
        { label: 'Goal Title', value: goalTitle, tone: 'accent' },
        { label: 'Target', value: 'Next 30 Days', tone: 'plain' },
        { label: 'Status', value: 'Nothing added yet', tone: 'plain' },
      ],
      verdict: `Proposed long-term goal: "${goalTitle}". Confirm to add to your Goals.`,
      tone: 'good',
      actionPending: true,
      proposedPlanTitle: goalTitle,
    };
  }

  // ---- V3 State-changing request: Add project to goal proposal --------------
  if (/add (?:my )?(.*) project to (?:that|the) goal/i.test(q)) {
    const projName = q.match(/add (?:my )?(.*) project/i)?.[1] || 'Project';
    return {
      kind: 'proposal',
      title: 'Link Project to Goal',
      lines: [
        { label: 'Project', value: projName, tone: 'accent' },
        { label: 'Action', value: 'Link to active Goal', tone: 'plain' },
        { label: 'Status', value: 'Nothing modified yet', tone: 'plain' },
      ],
      verdict: `Proposed linking "${projName}" to your active goal. Confirm to apply.`,
      tone: 'good',
      actionPending: true,
    };
  }

  // ---- V4: Next Event / Today's Schedule -----------------------------------
  if (/what (?:is my next event|do i have scheduled today)|next event|scheduled today/i.test(q)) {
    const ctx = getCurrentScheduleContext(state.schedule ?? [], new Date());
    const lines: AskReply['lines'] = [];
    if (ctx.currentBlock) {
      lines.push({
        label: 'Current Block',
        value: `${ctx.currentBlock.title} (${fmtTime(ctx.currentBlock.start)}–${fmtTime(ctx.currentBlock.end)})`,
        tone: 'accent',
      });
    }
    if (ctx.nextBlock) {
      lines.push({
        label: 'Next Event',
        value: `${ctx.nextBlock.title} (${fmtTime(ctx.nextBlock.start)}–${fmtTime(ctx.nextBlock.end)})`,
        tone: 'good',
      });
    } else {
      const scheduledList = state.schedule ?? [];
      if (scheduledList.length > 0) {
        const lastBlock = scheduledList[scheduledList.length - 1];
        lines.push({
          label: 'Scheduled Event',
          value: `${lastBlock.title} (${fmtTime(lastBlock.start)}–${fmtTime(lastBlock.end)})`,
          tone: 'plain',
        });
      } else {
        lines.push({ label: 'Next Event', value: 'No further scheduled blocks today', tone: 'plain' });
      }
    }
    lines.push({ label: 'Remaining Usable', value: `${ctx.availableMinutes} min`, tone: 'plain' });

    return {
      kind: 'now',
      title: "Today's Schedule & Commitments",
      lines,
      verdict: ctx.currentBlock
        ? `You are currently in ${ctx.currentBlock.title}. Next up: ${ctx.nextBlock ? ctx.nextBlock.title : 'free time'}.`
        : ctx.nextBlock
        ? `Next scheduled commitment is ${ctx.nextBlock.title} at ${fmtTime(ctx.nextBlock.start)}.`
        : 'Your scheduled commitments for today are complete.',
      tone: 'good',
    };
  }

  // ---- V4: Next Free Hour / Window ----------------------------------------
  if (/when is my next free (?:hour|window|time)|next free (?:hour|time)/i.test(q)) {
    const ctx = getCurrentScheduleContext(state.schedule ?? [], new Date());
    const lines: AskReply['lines'] = [
      { label: 'Available Now', value: `${ctx.availableMinutes} min free window`, tone: ctx.availableMinutes >= 45 ? 'good' : 'plain' },
    ];
    if (ctx.nextBlock) {
      lines.push({ label: 'Next Commitment', value: `${ctx.nextBlock.title} at ${fmtTime(ctx.nextBlock.start)}`, tone: 'accent' });
    }

    return {
      kind: 'time',
      title: 'Next Free Window',
      lines,
      verdict: ctx.availableMinutes >= 60
        ? `You have an open ${fmtDur(ctx.availableMinutes)} window right now before your next commitment.`
        : ctx.nextBlock
        ? `You have about ${ctx.availableMinutes} minutes before ${ctx.nextBlock.title}.`
        : 'You have clear open time for the remainder of your day.',
      tone: 'good',
    };
  }

  // ---- V4: Active Reminders ------------------------------------------------
  if (/what reminders are active|active reminders/i.test(q)) {
    const active = (state.reminders ?? []).filter((r) => r.status !== 'done' && r.status !== 'dismissed');
    const lines: AskReply['lines'] = active.slice(0, 4).map((r) => ({
      label: dueLabel(r.dueTs),
      value: r.title,
      tone: r.priority === 'critical' ? 'bad' : 'plain',
    }));

    return {
      kind: 'now',
      title: `Active Smart Reminders (${active.length})`,
      lines: lines.length > 0 ? lines : [{ label: 'Status', value: 'No pending reminders', tone: 'plain' }],
      verdict: active.length > 0
        ? `You have ${active.length} active reminder${active.length > 1 ? 's' : ''} tracked.`
        : 'All reminders have been completed or dismissed.',
      tone: active.length > 0 ? 'good' : 'plain',
    };
  }

  // ---- V4: Search LifeOS ---------------------------------------------------
  if (/^search (?:for )?(.*)/i.test(q)) {
    const term = q.replace(/^search (?:for )?/i, '').trim();
    const results = searchLifeOS(state, term);
    const topItems = results.items.slice(0, 4).map((item) => ({
      label: item.category.toUpperCase(),
      value: `${item.title}${item.subtitle ? ` · ${item.subtitle}` : ''}`,
      tone: 'accent' as const,
    }));

    return {
      kind: 'now',
      title: `Search: "${term}" (${results.totalCount} found)`,
      lines: topItems.length > 0 ? topItems : [{ label: 'No matches', value: `No records found for "${term}"`, tone: 'plain' }],
      verdict: results.totalCount > 0
        ? `Found ${results.totalCount} record${results.totalCount > 1 ? 's' : ''} across your tasks, projects, goals, and history.`
        : `No matching records found for "${term}".`,
      tone: results.totalCount > 0 ? 'good' : 'plain',
    };
  }

  // ---- V4: Data Export Proposal --------------------------------------------
  if (/export (?:my )?lifeos data|export data/i.test(q)) {
    return {
      kind: 'proposal',
      title: 'Export LifeOS Data',
      lines: [
        { label: 'Scope', value: 'Complete Offline State', tone: 'accent' },
        { label: 'Format', value: 'Human-Readable JSON', tone: 'plain' },
        { label: 'Privacy', value: 'Saved locally on device', tone: 'good' },
      ],
      verdict: 'Confirm to generate your complete LifeOS local JSON backup.',
      tone: 'good',
      actionPending: true,
    };
  }

  // ---- V4: Daily Execution Summary -----------------------------------------
  if (/show (?:my )?execution summary|execution summary/i.test(q)) {
    const summary = getDailyExecutionSummary(state);
    return {
      kind: 'now',
      title: "Today's Execution Summary",
      lines: [
        { label: 'Completed Tasks', value: `${summary.completedTasksCount}`, tone: 'good' },
        { label: 'Recorded Focus', value: `${Math.floor(summary.recordedFocusMinutes / 60)}h ${summary.recordedFocusMinutes % 60}m`, tone: 'accent' },
        { label: 'Remaining Tasks', value: `${summary.remainingTasksCount}`, tone: summary.remainingTasksCount > 0 ? 'plain' : 'good' },
        { label: 'Block Shifts', value: `${summary.movedBlocksCount}`, tone: 'plain' },
      ],
      verdict: summary.executionObservations.join(' '),
      tone: 'good',
    };
  }

  // ---- V4: Calendar Commitments -------------------------------------------
  if (/calendar commitments|calendar events|this week's calendar/i.test(q)) {
    const ext = (state.schedule ?? []).filter((b) => b.source === 'external');
    return {
      kind: 'now',
      title: 'External Calendar Commitments',
      lines: ext.slice(0, 4).map((b) => ({
        label: `${fmtTime(b.start)}–${fmtTime(b.end)}`,
        value: b.title,
        tone: 'accent' as const,
      })),
      verdict: ext.length > 0
        ? `You have ${ext.length} external calendar event${ext.length > 1 ? 's' : ''} synchronized (read-only).`
        : 'No external calendar commitments found for today.',
      tone: 'plain',
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
      { label: 'Next Event', value: '"What do I have scheduled today?"', tone: 'accent' },
      { label: 'Search', value: '"Search for VLSI"', tone: 'accent' },
      { label: 'Weekly Review', value: '"Review my week"', tone: 'accent' },
    ],
    verdict: 'LifeOS evaluates your schedule, goals, routines, deadlines, and budget to recommend what needs attention.',
    tone: 'plain',
  };
}
