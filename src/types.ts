export type BlockType =
  | 'fixed'
  | 'study'
  | 'work'
  | 'errand'
  | 'fitness'
  | 'meal'
  | 'rest'
  | 'generic';

export interface ScheduleBlock {
  id: string;
  title: string;
  type: BlockType;
  start: number; // minutes from midnight
  end: number;
  note?: string;
  done: boolean;
}

export interface ParsedItem {
  title: string;
  type: BlockType;
  duration: number;
  start?: number;
  end?: number;
  flexible: boolean;
}

export type ExpenseCategory = 'food' | 'travel' | 'shopping' | 'education' | 'technology' | 'other';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  ts: number;
}

export type Priority = 'critical' | 'important' | 'normal';

export type ReminderStatus = 'new' | 'tracked' | 'done' | 'dismissed';

export interface Reminder {
  id: string;
  title: string;
  source: string;
  dueTs: number;
  status: ReminderStatus;
  icon?: string;
  priority?: Priority;
}

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  deadline?: number;
  color?: string;
  icon?: string;
}

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  dueTs: number; // timestamp
  tag?: string;
  done: boolean;
  note?: string;
  createdAt: number;
  projectId?: string; // Optional relationship to Project
  estimatedMinutes?: number;
}

export interface FocusSession {
  id: string;
  taskId: string;
  projectId?: string;
  startedAt: number; // timestamp
  endedAt: number; // timestamp
  durationMinutes: number;
  completed?: boolean;
}

export type FocusState = 'idle' | 'running' | 'paused' | 'completed';

export type HabitFrequency = 'daily';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetPerPeriod: number; // 1
  createdAt: number;
  active: boolean;
  icon?: string;
  color?: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  dateKey: string; // YYYY-MM-DD in local time
  completedAt: number;
}

export type DailyMood = 'bad' | 'neutral' | 'good' | 'great'; // 😞 😐 🙂 😄

export interface DailyReview {
  dateKey: string; // YYYY-MM-DD
  completedTasks: number;
  completedHabits: number;
  focusMinutes: number;
  plannedMinutes: number;
  spentAmount: number;
  mood?: DailyMood;
  reflection?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalInsight {
  id: string;
  category: 'focus' | 'habits' | 'tasks' | 'time' | 'money';
  title: string;
  observation: string;
  timePeriod: string;
  factualBasis: string;
}

export interface AppState {
  name: string;
  scheduleInput: string;
  schedule: ScheduleBlock[];
  expenses: Expense[];
  reminders: Reminder[];
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  focusSessions: FocusSession[];
  dailyReviews: DailyReview[];
  activeTaskId?: string | null;
  activeTaskStartedAt?: number | null;
  activeTaskPausedAt?: number | null;
  activeTaskAccumulatedMs?: number;
  dailyBudget: number;
  weeklyBudget: number;
  monthlyBudget: number;
  reportStreak: number;
  workDayStart?: number; // minutes from midnight (default 540 = 09:00)
  workDayEnd?: number; // minutes from midnight (default 1260 = 21:00)
}

export interface AskLine {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'plain' | 'accent';
}

export interface AskReply {
  kind: 'budget' | 'time' | 'now' | 'help';
  title: string;
  lines: AskLine[];
  verdict: string;
  tone: 'good' | 'bad' | 'plain';
}

export interface RadarItem {
  id: string;
  type: 'deadline' | 'overdue_task' | 'spending' | 'reminder' | 'project_deadline' | 'project_blocked' | 'habit';
  urgency: 'critical' | 'high' | 'medium';
  title: string;
  subtitle: string;
  actionText?: string;
  actionType?: 'task' | 'reminder' | 'money' | 'plan' | 'project' | 'habit';
  targetId?: string;
  projectId?: string;
}

export interface WhatToDoNowResult {
  actionTitle: string;
  category: 'Critical Task' | 'Scheduled Block' | 'Approaching Deadline' | 'Free Gap' | 'All Done';
  reason: string;
  explanationLines?: string[];
  secondaryAction?: string;
  confidence: 'High' | 'Medium';
  durationMins?: number;
  tagColor: string;
  taskId?: string;
  blockId?: string;
  projectId?: string;
  projectName?: string;
  isStarted?: boolean;
}

export interface UsableTimeInfo {
  windowStart: number;
  windowEnd: number;
  totalUsableMinutes: number;
  remainingUsableMinutes: number;
  scheduledMinutes: number;
  formattedRemaining: string;
  formattedScheduled: string;
  formattedTotal: string;
}


