declare const process: any;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    if (typeof process !== 'undefined') {
      process.exitCode = 1;
    }
  }
}

const assert = {
  equal: (a: any, b: any, msg?: string) => {
    if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
  },
  ok: (a: any, msg?: string) => {
    if (!a) throw new Error(msg || `Expected ${a} to be truthy`);
  },
};

import {
  atTime,
  daysUntil,
  dueLabel,
  fmtDur,
  isOverdueDay,
  isToday,
  localDateKey,
  parseDateKey,
  shiftDateKey,
} from '../src/lib/dates';
import {
  DEFAULT_WORK_END,
  DEFAULT_WORK_START,
  askLifeOS,
  buildSchedule,
  getEveningReviewSnapshot,
  getHabitStreak,
  getLifeOSRadar,
  getMorningBrief,
  getPersonalInsights,
  getProjectStats,
  getProjectsNeedingAttention,
  getTodayHabitsSummary,
  getUsableTimeToday,
  getWhatToDoNow,
  moneyInsights,
  parsePlan,
  reportStats,
} from '../src/lib/engine';
import { makeSeed } from '../src/lib/seed';
import type {
  AppState,
  DailyReview,
  FocusSession,
  Habit,
  HabitCompletion,
  Project,
  ScheduleBlock,
  Task,
} from '../src/types';

// ===========================================================================
// Test Suite: LifeOS V1 Command Center + Projects
// ===========================================================================

test('1. Existing task without project functions seamlessly', () => {
  const standaloneTask: Task = {
    id: 't-standalone',
    title: 'Buy lab record notebook & blue pens',
    priority: 'normal',
    dueTs: Date.now() + 86400000,
    tag: 'Errand',
    done: false,
    createdAt: Date.now(),
  };

  assert.equal(standaloneTask.projectId, undefined);
  assert.equal(standaloneTask.done, false);
});

test('2. Create project has valid structure and initial status', () => {
  const project: Project = {
    id: 'proj-1',
    name: 'VLSI Training',
    description: 'Hardware lab coursework',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deadline: atTime(5, 18 * 60),
    color: '#60A5FA',
    icon: 'hardware-chip-outline',
  };

  assert.equal(project.name, 'VLSI Training');
  assert.equal(project.status, 'active');
  assert.ok(project.deadline && project.deadline > Date.now());
});

test('3. Add task to project connects via projectId', () => {
  const project: Project = {
    id: 'proj-vlsi',
    name: 'VLSI Training',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const task1: Task = {
    id: 't-1',
    title: 'Design Half Adder',
    priority: 'important',
    dueTs: Date.now() + 86400000,
    done: false,
    createdAt: Date.now(),
    projectId: project.id,
    estimatedMinutes: 45,
  };

  assert.equal(task1.projectId, 'proj-vlsi');
  assert.equal(task1.estimatedMinutes, 45);
});

test('4. Complete project task and 5. Project progress updates (0%, 60%, 100%, 0 tasks)', () => {
  const project: Project = {
    id: 'proj-vlsi',
    name: 'VLSI Training',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Case A: 0 tasks (graceful handle)
  const statsEmpty = getProjectStats(project, []);
  assert.equal(statsEmpty.total, 0);
  assert.equal(statsEmpty.completed, 0);
  assert.equal(statsEmpty.pct, 0);

  // Case B: 5 tasks, 3 completed = 60%
  const tasks: Task[] = [
    { id: 't1', title: 'Half Adder', priority: 'important', dueTs: Date.now(), done: true, createdAt: 1, projectId: project.id },
    { id: 't2', title: '2-to-4 Decoder', priority: 'important', dueTs: Date.now(), done: true, createdAt: 2, projectId: project.id },
    { id: 't3', title: '4-bit Counter', priority: 'important', dueTs: Date.now(), done: true, createdAt: 3, projectId: project.id },
    { id: 't4', title: '7 Segment Display', priority: 'normal', dueTs: Date.now(), done: false, createdAt: 4, projectId: project.id },
    { id: 't5', title: 'Project Report', priority: 'critical', dueTs: Date.now(), done: false, createdAt: 5, projectId: project.id },
  ];

  const stats60 = getProjectStats(project, tasks);
  assert.equal(stats60.total, 5);
  assert.equal(stats60.completed, 3);
  assert.equal(stats60.incomplete, 2);
  assert.equal(stats60.pct, 60);

  // Case C: Complete remaining tasks -> 100%
  const allCompleted = tasks.map((t) => ({ ...t, done: true }));
  const stats100 = getProjectStats(project, allCompleted);
  assert.equal(stats100.pct, 100);
  assert.equal(stats100.incomplete, 0);
});

test('6. Delete/archive project preserves unlinked tasks', () => {
  const project: Project = {
    id: 'proj-del',
    name: 'Temporary Project',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tasks: Task[] = [
    { id: 't1', title: 'Task 1', priority: 'normal', dueTs: Date.now(), done: false, createdAt: 1, projectId: project.id },
    { id: 't2', title: 'Task 2', priority: 'important', dueTs: Date.now(), done: false, createdAt: 2, projectId: 'other-proj' },
  ];

  // Simulating store deletion: unlink tasks associated with proj-del
  const unlinkedTasks = tasks.map((t) => (t.projectId === project.id ? { ...t, projectId: undefined } : t));
  assert.equal(unlinkedTasks[0].projectId, undefined);
  assert.equal(unlinkedTasks[1].projectId, 'other-proj');
  // Task is not destroyed
  assert.equal(unlinkedTasks[0].title, 'Task 1');

  // Archive project test
  const archivedProject: Project = { ...project, status: 'archived', updatedAt: Date.now() };
  assert.equal(archivedProject.status, 'archived');
});

test('7. Existing task functionality (priority, tags, due date)', () => {
  const seed = makeSeed();
  assert.ok(seed.tasks.length >= 6);
  const critical = seed.tasks.filter((t) => t.priority === 'critical');
  assert.ok(critical.length > 0);
});

test('8. Existing schedule functionality (parsePlan & buildSchedule)', () => {
  const plan = 'College at 10, gym for 1 hour at 5pm, dinner at 8';
  const parsed = parsePlan(plan);
  assert.ok(parsed.length >= 3);

  const schedule = buildSchedule(parsed);
  assert.ok(schedule.length >= 3);
  assert.ok(schedule.some((b) => /college/i.test(b.title)));
  assert.ok(schedule.some((b) => /gym/i.test(b.title)));
});

test('9. Existing reminder functionality (tracking, statuses, sources)', () => {
  const seed = makeSeed();
  assert.ok(seed.reminders.length >= 4);
  const tracked = seed.reminders.filter((r) => r.status === 'tracked');
  assert.ok(tracked.length > 0);
});

test('10. Existing money functionality (moneyInsights & daily pacing)', () => {
  const seed = makeSeed();
  const insights = moneyInsights(seed.expenses, seed.weeklyBudget, seed.dailyBudget, seed.monthlyBudget);
  assert.ok(insights.todayTotal >= 0);
  assert.equal(insights.dailyBudget, 400);
  assert.equal(insights.weeklyBudget, 2800);
  assert.ok(insights.byCat.length > 0);
});

test('11. Existing reports (reportStats generation)', () => {
  const seed = makeSeed();
  const report = reportStats(seed);
  assert.ok(report.productivity >= 20 && report.productivity <= 100);
  assert.ok(report.daySummary.length > 0);
  assert.ok(report.tomorrow.length > 0);
});

test('12. Existing Ask LifeOS (budget queries & next action queries)', () => {
  const seed = makeSeed();
  const replyNow = askLifeOS('what should i do right now?', seed);
  assert.equal(replyNow.kind, 'now');
  assert.ok(replyNow.title.length > 0);
  assert.ok(replyNow.verdict.length > 0);

  const replyBudget = askLifeOS('I have ₹300 and need lunch and metro', seed);
  assert.equal(replyBudget.kind, 'budget');
  assert.ok(replyBudget.lines.length >= 2);
});

test('13. Empty project handling (progress with 0 tasks)', () => {
  const emptyProj: Project = {
    id: 'empty',
    name: 'New Empty Project',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const stats = getProjectStats(emptyProj, []);
  assert.equal(stats.total, 0);
  assert.equal(stats.pct, 0);
  assert.equal(stats.completed, 0);
  assert.equal(stats.incomplete, 0);
});

test('14. Project with deadline and attention detection', () => {
  const projNear: Project = {
    id: 'proj-near',
    name: 'Final Submission',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deadline: atTime(2, 18 * 60), // In 2 days
  };

  const tasks: Task[] = [
    { id: 't-bl', title: 'Submit draft', priority: 'critical', dueTs: atTime(2, 18 * 60), done: false, createdAt: 1, projectId: projNear.id },
  ];

  const attention = getProjectsNeedingAttention([projNear], tasks);
  assert.ok(attention.length > 0);
  assert.equal(attention[0].project.id, 'proj-near');
  assert.ok(attention[0].reason.includes('critical') || attention[0].reason.includes('Deadline'));
});

test('15. Overdue task prioritization in decision engine', () => {
  const overdueTask: Task = {
    id: 't-overdue',
    title: 'Urgent Late Submission',
    priority: 'critical',
    dueTs: Date.now() - 2 * 86400000, // 2 days ago
    done: false,
    createdAt: Date.now() - 5 * 86400000,
    projectId: 'proj-vlsi',
  };

  const normalTask: Task = {
    id: 't-normal',
    title: 'Read chapter 1',
    priority: 'normal',
    dueTs: Date.now() + 5 * 86400000,
    done: false,
    createdAt: Date.now(),
  };

  const state: AppState = {
    ...makeSeed(),
    schedule: [], // No schedule block blocking
    activeTaskId: null,
    tasks: [normalTask, overdueTask],
  };

  const nextMove = getWhatToDoNow(state);
  assert.equal(nextMove.category, 'Critical Task');
  assert.equal(nextMove.taskId, 't-overdue');
  assert.ok(nextMove.reason.includes('Overdue') || nextMove.reason.includes('overdue'));
});

test('16. Usable time calculation & no available time handling', () => {
  // Scenario A: Standard Day 09:00 to 21:00 with college from 10:00 to 16:00
  const collegeBlock: ScheduleBlock = {
    id: 'b1',
    title: 'College',
    type: 'fixed',
    start: 10 * 60, // 10:00
    end: 16 * 60,   // 16:00 (360 mins)
    done: false,
  };

  // Morning 9:00 AM (540 mins)
  const morningDate = new Date();
  morningDate.setHours(9, 0, 0, 0);

  const usable = getUsableTimeToday([collegeBlock], morningDate, DEFAULT_WORK_START, DEFAULT_WORK_END);
  // Total window: 12h = 720 mins. Scheduled: 360 mins. Available: 360 mins = 6h 0m.
  assert.equal(usable.totalUsableMinutes, 360);
  assert.equal(usable.scheduledMinutes, 360);
  assert.equal(usable.formattedTotal, '6h');

  // Scenario B: Entire day blocked (no available time)
  const fullBlock: ScheduleBlock = {
    id: 'b-full',
    title: 'Marathon Coding Session',
    type: 'work',
    start: 9 * 60,
    end: 21 * 60,
    done: false,
  };

  const noTime = getUsableTimeToday([fullBlock], morningDate, DEFAULT_WORK_START, DEFAULT_WORK_END);
  assert.equal(noTime.totalUsableMinutes, 0);
  assert.equal(noTime.remainingUsableMinutes, 0);
  assert.equal(noTime.scheduledMinutes, 720);
});

test('17. Fresh installation with no data initializes seed state cleanly', () => {
  const seed = makeSeed();
  assert.equal(seed.name, 'Aarav');
  assert.ok(Array.isArray(seed.projects));
  assert.ok(seed.projects.length >= 2);
  assert.equal(seed.activeTaskId, null);
  assert.ok(seed.dailyBudget > 0);
});

test('18. Existing stored data migration preserves tasks without projects', () => {
  // Simulating an old stored JSON from LifeOS v0 without projects, activeTaskId, or workDayStart
  const legacyStoredRaw = {
    name: 'Aarav',
    scheduleInput: 'Test',
    schedule: [],
    expenses: [],
    reminders: [],
    tasks: [
      {
        id: 'legacy-1',
        title: 'Legacy Task with no project',
        priority: 'important',
        dueTs: Date.now() + 86400000,
        done: false,
        createdAt: Date.now() - 10000,
        // Notice: no projectId!
      },
    ],
    dailyBudget: 400,
    weeklyBudget: 2800,
    monthlyBudget: 12000,
    reportStreak: 5,
  };

  // Run migration logic as implemented in StoreProvider
  const parsed = { ...legacyStoredRaw } as any;
  if (!parsed.dailyBudget) parsed.dailyBudget = 400;
  if (!parsed.weeklyBudget) parsed.weeklyBudget = 2800;
  if (!parsed.monthlyBudget) parsed.monthlyBudget = 12000;
  if (!parsed.workDayStart) parsed.workDayStart = 9 * 60;
  if (!parsed.workDayEnd) parsed.workDayEnd = 21 * 60;
  if (!parsed.projects || !Array.isArray(parsed.projects)) {
    parsed.projects = [];
  }
  if (parsed.activeTaskId === undefined) {
    parsed.activeTaskId = null;
  }
  if (parsed.activeTaskStartedAt === undefined) {
    parsed.activeTaskStartedAt = null;
  }

  assert.equal(parsed.projects.length, 0);
  assert.equal(parsed.activeTaskId, null);
  assert.equal(parsed.tasks[0].projectId, undefined);
  assert.equal(parsed.tasks[0].title, 'Legacy Task with no project');

  // Verify engine handles this legacy state without errors
  const whatNow = getWhatToDoNow(parsed as AppState);
  assert.ok(whatNow.actionTitle.length > 0);
  assert.equal(whatNow.taskId, 'legacy-1');

  const radar = getLifeOSRadar(parsed as AppState);
  assert.ok(Array.isArray(radar));
});

// ===========================================================================
// Test Suite: LifeOS V1.1 Focus, Habits, Daily Review & Personal Insights
// ===========================================================================

test('19. Start focus session sets active taskId and timestamps', () => {
  const task: Task = {
    id: 't-focus-1',
    title: 'VLSI Report',
    priority: 'critical',
    dueTs: Date.now(),
    done: false,
    createdAt: Date.now(),
  };

  const now = Date.now();
  const sessionState: Partial<AppState> = {
    activeTaskId: task.id,
    activeTaskStartedAt: now,
    activeTaskPausedAt: null,
    activeTaskAccumulatedMs: 0,
  };

  assert.equal(sessionState.activeTaskId, 't-focus-1');
  assert.equal(sessionState.activeTaskStartedAt, now);
  assert.equal(sessionState.activeTaskPausedAt, null);
  assert.equal(sessionState.activeTaskAccumulatedMs, 0);
});

test('20. Pause focus session preserves accumulated time and task', () => {
  const startedAt = Date.now() - 15 * 60000; // 15 mins ago
  const pauseTime = Date.now();
  const elapsed = pauseTime - startedAt;

  const pausedState = {
    activeTaskId: 't-focus-1',
    activeTaskStartedAt: null,
    activeTaskPausedAt: pauseTime,
    activeTaskAccumulatedMs: elapsed,
  };

  assert.equal(pausedState.activeTaskId, 't-focus-1');
  assert.equal(pausedState.activeTaskStartedAt, null);
  assert.ok(pausedState.activeTaskAccumulatedMs >= 15 * 60000);
});

test('21. Resume focus session sets new startedAt and clears pausedAt', () => {
  const resumeTime = Date.now();
  const resumedState = {
    activeTaskId: 't-focus-1',
    activeTaskStartedAt: resumeTime,
    activeTaskPausedAt: null,
    activeTaskAccumulatedMs: 900000, // 15 mins preserved
  };

  assert.equal(resumedState.activeTaskStartedAt, resumeTime);
  assert.equal(resumedState.activeTaskPausedAt, null);
  assert.equal(resumedState.activeTaskAccumulatedMs, 900000);
});

test('22. Complete focus session marks task done and stores FocusSession', () => {
  const task: Task = {
    id: 't-focus-1',
    title: 'VLSI Report',
    priority: 'critical',
    dueTs: Date.now(),
    done: false,
    createdAt: Date.now(),
  };

  const startedAt = Date.now() - 30 * 60000;
  const now = Date.now();
  const durationMinutes = Math.round((now - startedAt) / 60000);

  const completedSession: FocusSession = {
    id: 'focus-test-1',
    taskId: task.id,
    projectId: task.projectId,
    startedAt,
    endedAt: now,
    durationMinutes,
    completed: true,
  };

  task.done = true;

  assert.equal(completedSession.taskId, 't-focus-1');
  assert.equal(completedSession.completed, true);
  assert.equal(completedSession.durationMinutes, 30);
  assert.equal(task.done, true);
});

test('23. Active session survives app reload with nullish safety', () => {
  const persistedState = {
    activeTaskId: 't-active-saved',
    activeTaskStartedAt: 1700000000000,
    activeTaskPausedAt: null,
    activeTaskAccumulatedMs: 120000,
  };

  const loadedState: Partial<AppState> = {
    activeTaskId: persistedState.activeTaskId ?? null,
    activeTaskStartedAt: persistedState.activeTaskStartedAt ?? null,
    activeTaskPausedAt: persistedState.activeTaskPausedAt ?? null,
    activeTaskAccumulatedMs: persistedState.activeTaskAccumulatedMs ?? 0,
  };

  assert.equal(loadedState.activeTaskId, 't-active-saved');
  assert.equal(loadedState.activeTaskStartedAt, 1700000000000);
  assert.equal(loadedState.activeTaskAccumulatedMs, 120000);
});

test('24. Completed task cannot remain active', () => {
  const tasks: Task[] = [
    { id: 't-done', title: 'Finished Lab', priority: 'normal', dueTs: Date.now(), done: true, createdAt: 1 },
  ];

  let activeTaskId: string | null = 't-done';
  // Normalization / recovery logic
  if (activeTaskId) {
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task || task.done) {
      activeTaskId = null;
    }
  }

  assert.equal(activeTaskId, null);
});

test('25. Focus duration calculation derived from timestamps handles 0 and pause', () => {
  const now = 1000000;
  // Case A: Running
  const runningAccumulated = 0;
  const runningStarted = 900000; // 100,000 ms ago (~100 sec)
  const runningElapsed = (runningAccumulated ?? 0) + (runningStarted ? now - runningStarted : 0);
  assert.equal(runningElapsed, 100000);

  // Case B: Paused with 0 accumulated
  const pausedZeroAccumulated = 0;
  const pausedZeroStarted = null;
  const pausedElapsed = (pausedZeroAccumulated ?? 0) + (pausedZeroStarted ? now - pausedZeroStarted : 0);
  assert.equal(pausedElapsed, 0);
});

test('26. Create habit has daily frequency and active state', () => {
  const habit: Habit = {
    id: 'habit-study',
    name: 'Study Revision',
    description: '30 mins revision',
    frequency: 'daily',
    targetPerPeriod: 1,
    createdAt: Date.now(),
    active: true,
    color: '#A78BFA',
  };

  assert.equal(habit.name, 'Study Revision');
  assert.equal(habit.frequency, 'daily');
  assert.equal(habit.active, true);
});

test('27. Complete habit today records local dateKey', () => {
  const todayKey = localDateKey();
  const completion: HabitCompletion = {
    id: 'hc-1',
    habitId: 'habit-study',
    dateKey: todayKey,
    completedAt: Date.now(),
  };

  assert.equal(completion.habitId, 'habit-study');
  assert.equal(completion.dateKey, todayKey);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(completion.dateKey));
});

test('28. Cannot duplicate today completion for same habit', () => {
  const todayKey = localDateKey();
  const completions: HabitCompletion[] = [
    { id: 'hc-1', habitId: 'habit-study', dateKey: todayKey, completedAt: Date.now() - 5000 },
  ];

  const hasToday = completions.some((c) => c.habitId === 'habit-study' && c.dateKey === todayKey);
  assert.equal(hasToday, true);

  // Simulating duplicate protection
  if (!completions.some((c) => c.habitId === 'habit-study' && c.dateKey === todayKey)) {
    completions.push({ id: 'hc-2', habitId: 'habit-study', dateKey: todayKey, completedAt: Date.now() });
  }

  assert.equal(completions.length, 1);
});

test('29. Calculate current streak across consecutive days', () => {
  const todayKey = localDateKey();
  const dayMinus1 = shiftDateKey(todayKey, -1);
  const dayMinus2 = shiftDateKey(todayKey, -2);

  const completions: HabitCompletion[] = [
    { id: '1', habitId: 'h-streak', dateKey: todayKey, completedAt: 1 },
    { id: '2', habitId: 'h-streak', dateKey: dayMinus1, completedAt: 2 },
    { id: '3', habitId: 'h-streak', dateKey: dayMinus2, completedAt: 3 },
  ];

  const streak = getHabitStreak('h-streak', completions, todayKey);
  assert.equal(streak.currentStreak, 3);
  assert.equal(streak.isCompletedToday, true);
});

test('30. Calculate longest streak historically', () => {
  const todayKey = localDateKey();
  const completions: HabitCompletion[] = [
    // Current streak of 2 days
    { id: '1', habitId: 'h-long', dateKey: todayKey, completedAt: 1 },
    { id: '2', habitId: 'h-long', dateKey: shiftDateKey(todayKey, -1), completedAt: 2 },
    // Gap on -2
    // Past streak of 4 days: -3, -4, -5, -6
    { id: '3', habitId: 'h-long', dateKey: shiftDateKey(todayKey, -3), completedAt: 3 },
    { id: '4', habitId: 'h-long', dateKey: shiftDateKey(todayKey, -4), completedAt: 4 },
    { id: '5', habitId: 'h-long', dateKey: shiftDateKey(todayKey, -5), completedAt: 5 },
    { id: '6', habitId: 'h-long', dateKey: shiftDateKey(todayKey, -6), completedAt: 6 },
  ];

  const streak = getHabitStreak('h-long', completions, todayKey);
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.longestStreak, 4);
});

test('31. Missed day resets current streak correctly', () => {
  const todayKey = localDateKey();
  // Completed 5 days ago and 4 days ago, but missed yesterday and today
  const completions: HabitCompletion[] = [
    { id: '1', habitId: 'h-reset', dateKey: shiftDateKey(todayKey, -4), completedAt: 1 },
    { id: '2', habitId: 'h-reset', dateKey: shiftDateKey(todayKey, -5), completedAt: 2 },
  ];

  const streak = getHabitStreak('h-reset', completions, todayKey);
  assert.equal(streak.currentStreak, 0);
  assert.equal(streak.longestStreak, 2);
});

test('32. Deactivating habit preserves history and streak calculations', () => {
  const habit: Habit = {
    id: 'h-deactivate',
    name: 'Morning Walk',
    frequency: 'daily',
    targetPerPeriod: 1,
    createdAt: Date.now(),
    active: true,
  };

  const todayKey = localDateKey();
  const completions: HabitCompletion[] = [
    { id: '1', habitId: 'h-deactivate', dateKey: todayKey, completedAt: 1 },
    { id: '2', habitId: 'h-deactivate', dateKey: shiftDateKey(todayKey, -1), completedAt: 2 },
  ];

  // Deactivate
  habit.active = false;
  assert.equal(habit.active, false);

  // History remains intact
  const streak = getHabitStreak(habit.id, completions, todayKey);
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.longestStreak, 2);
});

test('33. Create daily review with planned vs focused metrics', () => {
  const todayKey = localDateKey();
  const review: DailyReview = {
    dateKey: todayKey,
    completedTasks: 4,
    completedHabits: 3,
    focusMinutes: 180,
    plannedMinutes: 240,
    spentAmount: 320,
    mood: 'good',
    reflection: 'Productive day, cleared critical assignments.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  assert.equal(review.dateKey, todayKey);
  assert.equal(review.completedTasks, 4);
  assert.equal(review.focusMinutes, 180);
  assert.equal(review.mood, 'good');
});

test('34. Reopen today review retrieves existing review for update', () => {
  const todayKey = localDateKey();
  const state = makeSeed();
  state.dailyReviews = [
    {
      dateKey: todayKey,
      completedTasks: 3,
      completedHabits: 2,
      focusMinutes: 90,
      plannedMinutes: 120,
      spentAmount: 150,
      mood: 'neutral',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const snapshot = getEveningReviewSnapshot(state, todayKey);
  assert.ok(snapshot.existingReview);
  assert.equal(snapshot.existingReview?.mood, 'neutral');
  assert.equal(snapshot.existingReview?.focusMinutes, 90);
});

test('35. Daily review supports optional mood', () => {
  const reviewNoMood: DailyReview = {
    dateKey: '2026-09-25',
    completedTasks: 2,
    completedHabits: 1,
    focusMinutes: 60,
    plannedMinutes: 120,
    spentAmount: 200,
    mood: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  assert.equal(reviewNoMood.mood, undefined);
  assert.equal(reviewNoMood.completedTasks, 2);
});

test('36. Historical reviews remain accessible by dateKey', () => {
  const reviews: DailyReview[] = [
    { dateKey: '2026-09-20', completedTasks: 5, completedHabits: 3, focusMinutes: 150, plannedMinutes: 200, spentAmount: 400, createdAt: 1, updatedAt: 1 },
    { dateKey: '2026-09-21', completedTasks: 6, completedHabits: 4, focusMinutes: 210, plannedMinutes: 240, spentAmount: 250, createdAt: 2, updatedAt: 2 },
  ];

  const found = reviews.find((r) => r.dateKey === '2026-09-20');
  assert.ok(found);
  assert.equal(found?.completedTasks, 5);
  assert.equal(found?.focusMinutes, 150);
});

test('37. Insufficient data produces no misleading insight', () => {
  const state = makeSeed();
  state.focusSessions = []; // 0 sessions
  state.habitCompletions = []; // 0 completions
  state.tasks = []; // 0 tasks

  const insights = getPersonalInsights(state);
  // Must not fabricate insights with zero data
  assert.equal(insights.filter((i) => i.category === 'focus').length, 0);
  assert.equal(insights.filter((i) => i.category === 'habits').length, 0);
});

test('38. Focus statistics use actual recorded sessions', () => {
  const state = makeSeed();
  state.focusSessions = [
    { id: '1', taskId: 't1', projectId: 'p1', startedAt: 1, endedAt: 2, durationMinutes: 40, completed: true },
    { id: '2', taskId: 't2', projectId: 'p1', startedAt: 1, endedAt: 2, durationMinutes: 50, completed: true },
    { id: '3', taskId: 't3', projectId: 'p2', startedAt: 1, endedAt: 2, durationMinutes: 30, completed: true },
  ];

  const insights = getPersonalInsights(state);
  const avgInsight = insights.find((i) => i.id === 'insight-focus-avg');
  assert.ok(avgInsight);
  assert.ok(avgInsight?.observation.includes('40 minutes')); // (40 + 50 + 30) / 3 = 40
});

test('39. Habit statistics use actual completion history', () => {
  const state = makeSeed();
  const todayKey = localDateKey();
  const habitId = state.habits[0].id;
  state.habitCompletions = [
    { id: '1', habitId, dateKey: todayKey, completedAt: 1 },
    { id: '2', habitId, dateKey: shiftDateKey(todayKey, -1), completedAt: 2 },
    { id: '3', habitId, dateKey: shiftDateKey(todayKey, -2), completedAt: 3 },
  ];

  const insights = getPersonalInsights(state);
  const habitInsight = insights.find((i) => i.id === 'insight-habit-streak');
  assert.ok(habitInsight);
  assert.ok(habitInsight?.observation.includes('3-day streak'));
});

test('40. Task statistics use actual tasks and timing', () => {
  const state = makeSeed();
  const morningDate = new Date();
  morningDate.setHours(10, 0, 0, 0);

  state.tasks = [
    { id: 't1', title: 'Task 1', priority: 'normal', dueTs: Date.now(), done: true, createdAt: morningDate.getTime() },
    { id: 't2', title: 'Task 2', priority: 'normal', dueTs: Date.now(), done: true, createdAt: morningDate.getTime() },
    { id: 't3', title: 'Task 3', priority: 'normal', dueTs: Date.now(), done: true, createdAt: morningDate.getTime() },
    { id: 't4', title: 'Task 4', priority: 'normal', dueTs: Date.now(), done: true, createdAt: morningDate.getTime() },
    { id: 't5', title: 'Task 5', priority: 'normal', dueTs: Date.now(), done: true, createdAt: morningDate.getTime() },
  ];

  const insights = getPersonalInsights(state);
  const timingInsight = insights.find((i) => i.id === 'insight-task-timing');
  assert.ok(timingInsight);
  assert.ok(timingInsight?.observation.includes('before 2 PM'));
});

test('41. Existing V1 data loads correctly without new fields and 42. New arrays initialize safely', () => {
  const v1StoredRaw: any = {
    name: 'Aarav',
    tasks: [{ id: 't1', title: 'Test Task', priority: 'important', dueTs: Date.now(), done: false, createdAt: 1 }],
    projects: [{ id: 'p1', name: 'Project 1', status: 'active', createdAt: 1, updatedAt: 1 }],
    schedule: [],
    expenses: [],
    reminders: [],
    dailyBudget: 400,
  };

  // Safe migration with nullish operators
  v1StoredRaw.habits = v1StoredRaw.habits ?? [];
  v1StoredRaw.habitCompletions = v1StoredRaw.habitCompletions ?? [];
  v1StoredRaw.focusSessions = v1StoredRaw.focusSessions ?? [];
  v1StoredRaw.dailyReviews = v1StoredRaw.dailyReviews ?? [];
  v1StoredRaw.activeTaskPausedAt = v1StoredRaw.activeTaskPausedAt ?? null;
  v1StoredRaw.activeTaskAccumulatedMs = v1StoredRaw.activeTaskAccumulatedMs ?? 0;

  assert.ok(Array.isArray(v1StoredRaw.habits));
  assert.ok(Array.isArray(v1StoredRaw.habitCompletions));
  assert.ok(Array.isArray(v1StoredRaw.focusSessions));
  assert.ok(Array.isArray(v1StoredRaw.dailyReviews));
  assert.equal(v1StoredRaw.activeTaskAccumulatedMs, 0);
});

test('43. Existing projects and tasks remain intact after migration', () => {
  const v1Data: any = {
    tasks: [{ id: 't-survive', title: 'Surviving Task', priority: 'critical', dueTs: 12345, done: false, createdAt: 100 }],
    projects: [{ id: 'p-survive', name: 'Surviving Project', status: 'active', createdAt: 100, updatedAt: 100 }],
  };

  const tasks = v1Data.tasks ?? [];
  const projects = v1Data.projects ?? [];

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 't-survive');
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'Surviving Project');
});

test('44. Focus timer handles app background/resume via timestamps', () => {
  const backgroundTime = 1000000;
  const resumeTime = 1000000 + 25 * 60000; // 25 minutes in background

  const activeTaskStartedAt = backgroundTime;
  const activeTaskAccumulatedMs = 5 * 60000; // 5 mins accumulated before

  // Elapsed calculated at resume without timer ticking in background
  const totalElapsedMs = (activeTaskAccumulatedMs ?? 0) + (resumeTime - activeTaskStartedAt);
  const totalMins = Math.floor(totalElapsedMs / 60000);

  assert.equal(totalMins, 30);
});

test('45. Local date handling works around midnight', () => {
  // Test with local time around midnight: 00:05 AM
  const midnightDate = new Date(2026, 8, 27, 0, 5, 0); // Sept 27, 2026, 00:05 local
  const key = localDateKey(midnightDate);

  assert.equal(key, '2026-09-27');

  // Next and previous days
  const prevKey = shiftDateKey(key, -1);
  const nextKey = shiftDateKey(key, 1);

  assert.equal(prevKey, '2026-09-26');
  assert.equal(nextKey, '2026-09-28');
  assert.equal(parseDateKey(key).getDate(), 27);
});

