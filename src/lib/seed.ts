import type {
  AppState,
  DailyReview,
  DecisionRecord,
  Expense,
  FocusSession,
  Goal,
  Habit,
  HabitCompletion,
  PersonalPreference,
  Project,
  RecurringTask,
  Reminder,
  Routine,
  Task,
  TaskTemplate,
} from '../types';
import { atTime, localDateKey, shiftDateKey, uid } from './dates';
import { buildSchedule, parsePlan } from './engine';

export const SEED_INPUT =
  'I have college at 10, need to study 3 hours, buy groceries and finish my assignment.';

function seedGoals(): Goal[] {
  return [
    {
      id: 'goal-internship',
      title: 'Become Internship-Ready',
      description: 'Strengthen digital electronics foundations, finish campus capstone, and prepare resume',
      status: 'active',
      targetDate: Date.now() + 60 * 86400000,
      projectIds: ['proj-vlsi', 'proj-capstone'],
      createdAt: Date.now() - 15 * 86400000,
    },
  ];
}

function seedProjects(): Project[] {
  return [
    {
      id: 'proj-vlsi',
      name: 'VLSI Training',
      description: 'Digital electronics coursework, combinational logic design, and report',
      status: 'active',
      createdAt: Date.now() - 5 * 86400000,
      updatedAt: Date.now() - 86400000,
      deadline: atTime(6, 18 * 60), // Due in 6 days
      color: '#60A5FA',
      icon: 'hardware-chip-outline',
      goalId: 'goal-internship',
    },
    {
      id: 'proj-capstone',
      name: 'Campus Capstone',
      description: 'Autonomous systems capstone project with Prof. Mehta',
      status: 'active',
      createdAt: Date.now() - 10 * 86400000,
      updatedAt: Date.now() - 2 * 86400000,
      deadline: atTime(14, 17 * 60), // Due in 14 days
      color: '#A78BFA',
      icon: 'school-outline',
      goalId: 'goal-internship',
    },
  ];
}

function seedExpenses(): Expense[] {
  const out: Expense[] = [];
  // Today's spends with updated categories
  out.push({ id: uid(), amount: 110, category: 'food', note: 'Mess lunch', ts: atTime(0, 13 * 60 + 20) });
  out.push({ id: uid(), amount: 70, category: 'food', note: 'Samosa + chai', ts: atTime(0, 16 * 60 + 40) });
  out.push({ id: uid(), amount: 40, category: 'travel', note: 'Metro to college', ts: atTime(0, 9 * 60 + 10) });
  out.push({ id: uid(), amount: 80, category: 'travel', note: 'Auto back home', ts: atTime(0, 16 * 60 + 15) });
  out.push({ id: uid(), amount: 120, category: 'education', note: 'Reference book printout', ts: atTime(0, 11 * 60 + 5) });

  // Historical data across 7 days
  const past: Array<[number, number, Expense['category'], string]> = [
    [1, 210, 'food', 'Canteen + snacks'],
    [1, 90, 'travel', 'Bus + metro'],
    [1, 150, 'shopping', 'Stationery kit'],
    [2, 180, 'food', 'Mess + coffee'],
    [2, 60, 'travel', 'Metro pass recharge'],
    [2, 299, 'technology', 'Cloud storage subscription'],
    [3, 240, 'food', 'Wednesday dinner out'],
    [3, 80, 'travel', 'Auto fare'],
    [4, 160, 'food', 'Mess lunch'],
    [4, 250, 'education', 'Course workbook'],
    [5, 190, 'food', 'Canteen with friends'],
    [5, 70, 'travel', 'Bus commute'],
    [6, 320, 'shopping', 'Weekly groceries'],
  ];

  for (const [d, amount, category, note] of past) {
    out.push({ id: uid(), amount, category, note, ts: atTime(-d, 12 * 60 + Math.floor(Math.random() * 300)) });
  }
  return out;
}

function seedReminders(): Reminder[] {
  return [
    {
      id: uid(),
      title: 'Submit Digital Electronics Assignment 4',
      source: 'College portal',
      dueTs: atTime(0, 17 * 60), // Due today at 5 PM!
      status: 'tracked',
      icon: 'document-text-outline',
      priority: 'critical',
    },
    {
      id: uid(),
      title: 'Amazon return — wireless earphones',
      source: 'Detected · Amazon SMS',
      dueTs: atTime(1, 20 * 60),
      status: 'tracked',
      icon: 'return-up-back-outline',
      priority: 'important',
    },
    {
      id: uid(),
      title: 'Digital Electronics Midterm Exam',
      source: 'Academic Calendar',
      dueTs: atTime(3, 10 * 60),
      status: 'tracked',
      icon: 'school-outline',
      priority: 'critical',
    },
    {
      id: uid(),
      title: 'Cancel Spotify free trial before renewal',
      source: 'Detected · Gmail receipt',
      dueTs: atTime(4, 12 * 60),
      status: 'new',
      icon: 'musical-notes-outline',
      priority: 'normal',
    },
    {
      id: uid(),
      title: 'Electricity bill payment (₹840)',
      source: 'Detected · BSES SMS',
      dueTs: atTime(2, 18 * 60),
      status: 'new',
      icon: 'flash-outline',
      priority: 'important',
    },
  ];
}

function seedTasks(): Task[] {
  return [
    {
      id: 'task-seed-1',
      title: 'Revise Ch. 3 — Sequential Circuits',
      priority: 'critical',
      dueTs: atTime(0, 19 * 60), // Due today
      tag: 'Exam',
      done: false,
      note: 'Focus on Flip-flops and state diagrams',
      createdAt: Date.now() - 86400000,
      projectId: 'proj-vlsi',
      estimatedMinutes: 60,
    },
    {
      id: 'task-seed-2',
      title: 'Draft conclusion for Assignment 4',
      priority: 'critical',
      dueTs: atTime(0, 16 * 60), // Due today
      tag: 'College',
      done: false,
      note: 'Include simulation waveforms',
      createdAt: Date.now() - 43200000,
      projectId: 'proj-vlsi',
      estimatedMinutes: 45,
    },
    {
      id: 'task-seed-3',
      title: 'Simulate 4-bit Counter testbench',
      priority: 'important',
      dueTs: atTime(2, 18 * 60),
      tag: 'Academic',
      done: false,
      note: 'ModelSim verification',
      createdAt: Date.now() - 25000000,
      projectId: 'proj-vlsi',
      estimatedMinutes: 50,
    },
    {
      id: 'task-seed-4',
      title: 'Reply to Prof. Mehta about capstone project',
      priority: 'important',
      dueTs: atTime(1, 12 * 60), // Tomorrow
      tag: 'Academic',
      done: false,
      note: 'Send GitHub repo link',
      createdAt: Date.now() - 36000000,
      projectId: 'proj-capstone',
      estimatedMinutes: 20,
    },
    {
      id: 'task-seed-5',
      title: 'Buy lab record notebook & blue pens',
      priority: 'normal',
      dueTs: atTime(1, 18 * 60),
      tag: 'Errand',
      done: false,
      createdAt: Date.now() - 20000000,
      estimatedMinutes: 30,
    },
    {
      id: 'task-seed-6',
      title: '30 min DSA graph practice',
      priority: 'important',
      dueTs: atTime(0, 8 * 60),
      tag: 'Habit',
      done: true,
      createdAt: Date.now() - 86400000,
      estimatedMinutes: 30,
    },
    {
      id: 'task-seed-7',
      title: 'Upload study group notes to drive',
      priority: 'normal',
      dueTs: atTime(-1, 18 * 60),
      tag: 'College',
      done: true,
      createdAt: Date.now() - 172800000,
      projectId: 'proj-vlsi',
      estimatedMinutes: 15,
    },
  ];
}

function seedHabits(): Habit[] {
  return [
    {
      id: 'habit-study',
      name: 'Study & Deep Work',
      description: 'Minimum 45 mins focused study with no feeds',
      frequency: 'daily',
      targetPerPeriod: 1,
      createdAt: Date.now() - 14 * 86400000,
      active: true,
      icon: 'book-outline',
      color: '#A78BFA',
    },
    {
      id: 'habit-exercise',
      name: 'Workout / Physical Activity',
      description: 'Gym, running, or stretching',
      frequency: 'daily',
      targetPerPeriod: 1,
      createdAt: Date.now() - 14 * 86400000,
      active: true,
      icon: 'barbell-outline',
      color: '#F472B6',
    },
    {
      id: 'habit-reading',
      name: 'Read 20 Mins',
      description: 'Books or technical papers',
      frequency: 'daily',
      targetPerPeriod: 1,
      createdAt: Date.now() - 10 * 86400000,
      active: true,
      icon: 'reader-outline',
      color: '#60A5FA',
    },
    {
      id: 'habit-meditation',
      name: 'Mindful Breathing',
      description: 'Morning or night 10-min breathwork',
      frequency: 'daily',
      targetPerPeriod: 1,
      createdAt: Date.now() - 7 * 86400000,
      active: true,
      icon: 'flower-outline',
      color: '#2DD4BF',
    },
  ];
}

function seedHabitCompletions(): HabitCompletion[] {
  const todayKey = localDateKey();
  const d1 = shiftDateKey(todayKey, -1);
  const d2 = shiftDateKey(todayKey, -2);
  const d3 = shiftDateKey(todayKey, -3);
  const d4 = shiftDateKey(todayKey, -4);
  const d5 = shiftDateKey(todayKey, -5);

  return [
    // Study streak = 6 days (including today)
    { id: uid(), habitId: 'habit-study', dateKey: todayKey, completedAt: Date.now() - 3600000 },
    { id: uid(), habitId: 'habit-study', dateKey: d1, completedAt: Date.now() - 86400000 },
    { id: uid(), habitId: 'habit-study', dateKey: d2, completedAt: Date.now() - 2 * 86400000 },
    { id: uid(), habitId: 'habit-study', dateKey: d3, completedAt: Date.now() - 3 * 86400000 },
    { id: uid(), habitId: 'habit-study', dateKey: d4, completedAt: Date.now() - 4 * 86400000 },
    { id: uid(), habitId: 'habit-study', dateKey: d5, completedAt: Date.now() - 5 * 86400000 },

    // Exercise streak = 3 days (d1, d2, d3, but not yet today)
    { id: uid(), habitId: 'habit-exercise', dateKey: d1, completedAt: Date.now() - 86400000 },
    { id: uid(), habitId: 'habit-exercise', dateKey: d2, completedAt: Date.now() - 2 * 86400000 },
    { id: uid(), habitId: 'habit-exercise', dateKey: d3, completedAt: Date.now() - 3 * 86400000 },

    // Reading completed yesterday
    { id: uid(), habitId: 'habit-reading', dateKey: d1, completedAt: Date.now() - 86400000 },
  ];
}

function seedFocusSessions(): FocusSession[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      taskId: 'task-seed-6',
      startedAt: now - 3600000 * 5,
      endedAt: now - 3600000 * 5 + 30 * 60000,
      durationMinutes: 30,
      completed: true,
    },
    {
      id: uid(),
      taskId: 'task-seed-7',
      projectId: 'proj-vlsi',
      startedAt: now - 86400000 - 3600000 * 3,
      endedAt: now - 86400000 - 3600000 * 3 + 45 * 60000,
      durationMinutes: 45,
      completed: true,
    },
    {
      id: uid(),
      taskId: 'task-seed-1',
      projectId: 'proj-vlsi',
      startedAt: now - 2 * 86400000,
      endedAt: now - 2 * 86400000 + 40 * 60000,
      durationMinutes: 40,
      completed: true,
    },
    {
      id: uid(),
      taskId: 'task-seed-4',
      projectId: 'proj-capstone',
      startedAt: now - 3 * 86400000,
      endedAt: now - 3 * 86400000 + 35 * 60000,
      durationMinutes: 35,
      completed: true,
    },
  ];
}

function seedDailyReviews(): DailyReview[] {
  const todayKey = localDateKey();
  const d1 = shiftDateKey(todayKey, -1);
  return [
    {
      dateKey: d1,
      completedTasks: 3,
      completedHabits: 2,
      focusMinutes: 75,
      plannedMinutes: 240,
      spentAmount: 380,
      mood: 'good',
      reflection: 'Good focus in the evening. VLSI simulation progressed nicely.',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    },
  ];
}

function seedRecurringTasks(): RecurringTask[] {
  return [
    {
      id: 'rec-1',
      title: 'Review lecture notes & formulas',
      recurrence: 'weekdays',
      priority: 'important',
      estimatedMinutes: 30,
      projectId: 'proj-vlsi',
      tag: 'Academics',
      active: true,
      createdAt: Date.now() - 7 * 86400000,
    },
    {
      id: 'rec-2',
      title: 'Weekly project progress review',
      recurrence: 'weekly',
      dayOfWeek: 0, // Sunday
      priority: 'normal',
      estimatedMinutes: 45,
      active: true,
      createdAt: Date.now() - 14 * 86400000,
    },
    {
      id: 'rec-3',
      title: 'Monthly subscription & bill audit',
      recurrence: 'monthly',
      dayOfMonth: 1,
      priority: 'normal',
      estimatedMinutes: 20,
      active: true,
      createdAt: Date.now() - 30 * 86400000,
    },
  ];
}

function seedRoutines(): Routine[] {
  return [
    {
      id: 'routine-morning-launch',
      title: 'Morning Launch Routine',
      description: 'Prepare for high-leverage deep work sessions',
      active: true,
      preferredTimeMinutes: 8 * 60 + 30,
      category: 'morning',
      items: [
        { id: uid(), title: 'Hydrate & 10m stretch', durationMinutes: 10, type: 'fitness' },
        { id: uid(), title: 'Review Today & Next Move', durationMinutes: 15, type: 'generic' },
        { id: uid(), title: 'Deep Work Sprint (60m)', durationMinutes: 60, type: 'study', taskType: 'deep_work' },
      ],
      createdAt: Date.now() - 10 * 86400000,
    },
  ];
}

function seedPersonalPreferences(): PersonalPreference[] {
  return [
    {
      id: 'pref-deep-work',
      key: 'preferred_deep_work_window',
      value: '09:00 - 12:00',
      source: 'user',
      createdAt: Date.now() - 14 * 86400000,
      updatedAt: Date.now() - 14 * 86400000,
    },
    {
      id: 'pref-review-day',
      key: 'preferred_review_day',
      value: 'Sunday',
      source: 'user',
      createdAt: Date.now() - 14 * 86400000,
      updatedAt: Date.now() - 14 * 86400000,
    },
  ];
}

function seedTaskTemplates(): TaskTemplate[] {
  return [
    {
      id: 'tmpl-lab-report',
      title: 'Lab Experiment & Report',
      description: 'Standard technical report breakdown for engineering labs',
      category: 'Academics',
      items: [
        { title: 'Read experiment theory & manual', estimatedMinutes: 20, priority: 'normal', taskType: 'quick_task' },
        { title: 'Collect & record observations', estimatedMinutes: 30, priority: 'normal', taskType: 'deep_work' },
        { title: 'Simulate waveforms / calculate results', estimatedMinutes: 45, priority: 'important', taskType: 'deep_work' },
        { title: 'Write discussion & conclusion', estimatedMinutes: 30, priority: 'normal', taskType: 'admin' },
      ],
      createdAt: Date.now() - 12 * 86400000,
    },
  ];
}

function seedDecisionRecords(): DecisionRecord[] {
  return [
    {
      id: 'rec-dec-1',
      timestamp: Date.now() - 86400000,
      type: 'next_action',
      subjectId: 'task-seed-1',
      subjectTitle: 'Revise Ch. 3 — Sequential Circuits',
      reasons: ['Due today', 'Unblocked', 'Matches active VLSI Training project'],
      actionTaken: 'started',
      outcome: 'completed',
    },
  ];
}

export function makeSeed(): AppState {
  return {
    name: 'Aarav',
    scheduleInput: SEED_INPUT,
    schedule: buildSchedule(parsePlan(SEED_INPUT)),
    expenses: seedExpenses(),
    reminders: seedReminders(),
    tasks: seedTasks(),
    projects: seedProjects(),
    habits: seedHabits(),
    habitCompletions: seedHabitCompletions(),
    focusSessions: seedFocusSessions(),
    dailyReviews: seedDailyReviews(),
    activeTaskId: null,
    activeTaskStartedAt: null,
    activeTaskPausedAt: null,
    activeTaskAccumulatedMs: 0,
    dailyBudget: 400,
    weeklyBudget: 2800,
    monthlyBudget: 12000,
    reportStreak: 6,
    workDayStart: 9 * 60, // 09:00
    workDayEnd: 21 * 60, // 21:00
    planningPreferences: {
      deepWorkWindow: { start: 9 * 60, end: 12 * 60 },
      lightWorkWindow: { start: 14 * 60, end: 17 * 60 },
      personalWindow: { start: 19 * 60, end: 24 * 60 },
      useHistoricalEstimateAdjustment: false,
    },
    adaptiveProposals: [],
    weeklyPlanConfirmed: false,
    goals: seedGoals(),
    recurringTasks: seedRecurringTasks(),
    routines: seedRoutines(),
    personalPreferences: seedPersonalPreferences(),
    decisionRecords: seedDecisionRecords(),
    taskTemplates: seedTaskTemplates(),
    notificationPreferences: {
      enabled: true,
      taskReminders: true,
      deadlineReminders: true,
      routineReminders: true,
      weeklyReviewReminder: true,
      quietHours: {
        start: 22 * 60 + 30, // 22:30
        end: 7 * 60,         // 07:00
      },
    },
    localNotifications: [],
    calendarSync: {
      status: 'synced',
      lastSyncedAt: Date.now() - 3600000,
      importedEventCount: 1,
      connectedCalendarName: 'College & Academic Calendar',
    },
    externalCalendarEvents: [
      {
        id: 'evt-ece-lab',
        calendarId: 'cal-academic',
        title: 'ECE Department Lab Session',
        start: Date.now() + 2 * 3600000,
        end: Date.now() + 3.5 * 3600000,
        location: 'VLSI Lab 302',
      },
    ],
  };
}
