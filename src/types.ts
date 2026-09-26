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
  source?: 'lifeos' | 'external';
  taskId?: string;
  externalEventId?: string;
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
export type TaskType = 'deep_work' | 'quick_task' | 'admin' | 'personal';

export type ReminderStatus = 'new' | 'tracked' | 'done' | 'dismissed';
export type ReminderTriggerType = 'specific_time' | 'before_deadline' | 'after_inactivity' | 'recurring';
export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Reminder {
  id: string;
  title: string;
  source: string;
  dueTs: number;
  status: ReminderStatus;
  icon?: string;
  priority?: Priority;
  triggerType?: ReminderTriggerType;
  relatedTaskId?: string;
  relatedProjectId?: string;
  triggerCondition?: string;
  recurrence?: RecurrenceRule;
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
  goalId?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'paused';
  targetDate?: number;
  projectIds: string[];
  createdAt: number;
  completedAt?: number;
}

export interface RecurringTask {
  id: string;
  title: string;
  priority: Priority;
  recurrence: RecurrenceRule;
  dayOfWeek?: number; // 0=Sunday..6=Saturday for weekly
  dayOfMonth?: number; // 1..31 for monthly
  estimatedMinutes?: number;
  taskType?: TaskType;
  projectId?: string;
  tag?: string;
  active: boolean;
  endDate?: number;
  lastGeneratedDateKey?: string;
  createdAt: number;
}

export interface RoutineItem {
  id: string;
  title: string;
  durationMinutes: number;
  type?: BlockType;
  taskType?: TaskType;
}

export interface Routine {
  id: string;
  title: string;
  description?: string;
  items: RoutineItem[];
  preferredTimeMinutes?: number; // e.g. 450 = 07:30
  active: boolean;
  category?: 'morning' | 'evening' | 'work' | 'study' | 'custom';
  createdAt: number;
}

export interface PersonalPreference {
  id: string;
  key: string;
  value: string;
  source: 'user' | 'observed';
  confidence?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskTemplateItem {
  title: string;
  estimatedMinutes?: number;
  priority: Priority;
  taskType?: TaskType;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  items: TaskTemplateItem[];
  createdAt: number;
}

export interface DecisionRecord {
  id: string;
  timestamp: number;
  type: 'next_action' | 'reschedule' | 'breakdown' | 'weekly_plan' | 'reminder' | 'routine';
  subjectId?: string;
  subjectTitle: string;
  reasons: string[];
  actionTaken?: string;
  outcome?: string;
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
  taskType?: TaskType;
  blockedBy?: string[];
  recurringTaskId?: string;
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

export interface PlanningPreferences {
  deepWorkWindow?: { start: number; end: number }; // minutes from midnight (e.g. 540 = 09:00, 720 = 12:00)
  lightWorkWindow?: { start: number; end: number }; // minutes from midnight (e.g. 840 = 14:00, 1020 = 17:00)
  personalWindow?: { start: number; end: number }; // minutes from midnight (e.g. 1140 = 19:00, 1440 = 24:00)
  useHistoricalEstimateAdjustment?: boolean; // Phase 6 estimation learning toggle
}

export interface GoalProgress {
  goal: Goal;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  nextProjectName?: string;
  nextActionTitle?: string;
  daysRemaining?: number;
  statusSummary: string;
}

export interface BehavioralPattern {
  id: string;
  category: 'focus_time' | 'duration' | 'completion' | 'estimation';
  observation: string;
  sampleSize: number;
  confidence: 'early' | 'recorded' | 'insufficient';
  metric?: string;
}

export interface EstimationLearningResult {
  hasSufficientData: boolean;
  sampleSize: number;
  estimatedTotalMinutes: number;
  actualTotalMinutes: number;
  ratio: number;
  adjustmentPct: number;
  message: string;
}

export interface WeeklyReviewV2Summary {
  dateKeyRange: { start: string; end: string };
  tasksCompleted: number;
  focusMinutes: number;
  plannedMinutes: number;
  activeProjectsCount: number;
  upcomingDeadlinesCount: number;
  shiftedBlocksCount: number;
  completedRoutinesCount: number;
  carryOverTasksCount: number;
  mostRecordedFocusWindow: string;
  comparisonWithPriorWeek?: {
    focusMinutesDelta: number;
    tasksCompletedDelta: number;
    focusTrendText: string;
  };
}

export interface AdaptiveProposal {
  id: string;
  taskId?: string;
  taskTitle: string;
  blockId?: string;
  oldStart?: number;
  oldEnd?: number;
  newStart: number;
  newEnd: number;
  reason: string;
  impact: string;
  priority: Priority;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
  createdAt: number;
}

export interface DayStatus {
  state: 'on_track' | 'shifted' | 'open' | 'completed';
  headline: string;
  summary: string;
  explanation: string;
  shiftMinutes?: number;
  proposalsCount?: number;
  remainingUsableMinutes: number;
}

export interface ProposedTask {
  id: string;
  title: string;
  estimatedMinutes?: number;
  priority: Priority;
  taskType?: TaskType;
  projectId?: string;
  dueTs?: number;
  selected: boolean;
}

export interface ProjectDeadlinePressure {
  projectId: string;
  projectName: string;
  deadline: number;
  daysRemaining: number;
  remainingTasksCount: number;
  estimatedRemainingMinutes: number;
  hasEstimatedData: boolean;
  availableUsableMinutes: number;
  differenceMinutes: number;
  statusText: string;
  isPressureHigh: boolean;
  completionPercentage: number;
}

export interface WeeklyPlanningSummary {
  lastWeek: {
    tasksCompleted: number;
    focusMinutes: number;
    habitConsistencyPct: number;
    plannedMinutes: number;
    actualMinutes: number;
    projectsProgressed: number;
  };
  thisWeek: {
    upcomingDeadlinesCount: number;
    activeProjectsCount: number;
    highPriorityTasksCount: number;
    scheduledCommitmentsMinutes: number;
    availableUsableHours: number;
  };
  weeklyPlan: {
    totalUsableHours: number;
    committedHours: number;
    suggestedTaskCapacityHours: number;
    planConfirmed?: boolean;
  };
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
  planningPreferences?: PlanningPreferences;
  adaptiveProposals?: AdaptiveProposal[];
  weeklyPlanConfirmed?: boolean;
  goals?: Goal[];
  recurringTasks?: RecurringTask[];
  routines?: Routine[];
  personalPreferences?: PersonalPreference[];
  decisionRecords?: DecisionRecord[];
  taskTemplates?: TaskTemplate[];
  notificationPreferences?: NotificationPreferences;
  localNotifications?: LocalNotification[];
  calendarSync?: CalendarSyncState;
  externalCalendarEvents?: ExternalCalendarEvent[];
}

export interface AskLine {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'plain' | 'accent';
}

export interface AskReply {
  kind: 'budget' | 'time' | 'now' | 'help' | 'proposal' | 'plan';
  title: string;
  lines: AskLine[];
  verdict: string;
  tone: 'good' | 'bad' | 'plain';
  proposedTasks?: ProposedTask[];
  proposedPlanTitle?: string;
  proposedPlanProjectName?: string;
  actionPending?: boolean;
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

// ===========================================================================
// V4 Types: Notifications, Calendar, Timeline, Search, Execution
// ===========================================================================

export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  type: 'task' | 'deadline' | 'routine' | 'reminder' | 'focus' | 'weekly_review';
  sourceId?: string;
  scheduledAt: number;
  status: 'scheduled' | 'delivered' | 'cancelled';
  createdAt: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  taskReminders: boolean;
  deadlineReminders: boolean;
  routineReminders: boolean;
  weeklyReviewReminder: boolean;
  quietHours?: {
    start: number; // minutes from midnight (e.g. 1350 = 22:30)
    end: number;   // minutes from midnight (e.g. 420 = 07:00)
  };
}

export interface ExternalCalendar {
  id: string;
  name: string;
  color?: string;
  source: string;
  selected?: boolean;
}

export interface ExternalCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: number; // timestamp
  end: number;   // timestamp
  location?: string;
  isAllDay?: boolean;
}

export interface CalendarSyncState {
  status: 'never_synced' | 'synced' | 'failed';
  lastSyncedAt?: number;
  lastSyncError?: string;
  importedEventCount: number;
  connectedCalendarName?: string;
}

export interface CurrentScheduleContext {
  currentBlock?: ScheduleBlock;
  nextBlock?: ScheduleBlock;
  overdueBlocks: ScheduleBlock[];
  upcomingBlocks: ScheduleBlock[];
  pastBlocks: ScheduleBlock[];
  availableMinutes: number;
  status: 'in_block' | 'in_free_window' | 'day_ended' | 'before_day';
}

export type SearchFilter = 'all' | 'tasks' | 'projects' | 'goals' | 'history' | 'habits' | 'routines';

export interface SearchResultItem {
  id: string;
  category: 'task' | 'project' | 'goal' | 'history' | 'habit' | 'routine' | 'template';
  title: string;
  subtitle?: string;
  matchReason?: string;
  targetId: string;
  actionType?: 'task' | 'project' | 'goal';
}

export interface SearchResults {
  query: string;
  totalCount: number;
  items: SearchResultItem[];
}

export interface DailyExecutionSummary {
  dateKey: string;
  completedTasksCount: number;
  recordedFocusMinutes: number;
  scheduledMinutes: number;
  movedBlocksCount: number;
  remainingTasksCount: number;
  onTimeTasksCount: number;
  overrunTasksCount: number;
  executionObservations: string[];
}
