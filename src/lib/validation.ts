import type { AppState, ValidationResult, ValidationStats } from '../types';

export function validateAppState(state: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const stats: ValidationStats = {
    taskCount: 0,
    projectCount: 0,
    goalCount: 0,
    habitCount: 0,
    routineCount: 0,
    blockCount: 0,
    focusSessionCount: 0,
    decisionRecordCount: 0,
  };

  if (!state || typeof state !== 'object') {
    errors.push('State payload must be a non-null object.');
    return { valid: false, errors, warnings, stats };
  }

  // Helper for tracking unique IDs
  function checkUniqueIds(items: any[] | undefined, entityName: string): Set<string> {
    const idSet = new Set<string>();
    if (!Array.isArray(items)) {
      errors.push(`${entityName} must be an array.`);
      return idSet;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        errors.push(`${entityName}[${i}] is malformed.`);
        continue;
      }
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`${entityName}[${i}] is missing a valid string id.`);
        continue;
      }
      if (idSet.has(item.id)) {
        errors.push(`Duplicate ${entityName} ID detected: "${item.id}".`);
      } else {
        idSet.add(item.id);
      }
    }
    return idSet;
  }

  // 1. Check ID uniqueness & collect entity IDs
  const taskIds = checkUniqueIds(state.tasks, 'tasks');
  const projectIds = checkUniqueIds(state.projects, 'projects');
  const goalIds = checkUniqueIds(state.goals, 'goals');
  const habitIds = checkUniqueIds(state.habits, 'habits');
  const routineIds = checkUniqueIds(state.routines, 'routines');
  const blockIds = checkUniqueIds(state.schedule, 'schedule');
  const focusSessionIds = checkUniqueIds(state.focusSessions, 'focusSessions');
  const decisionRecordIds = checkUniqueIds(state.decisionRecords, 'decisionRecords');

  stats.taskCount = taskIds.size;
  stats.projectCount = projectIds.size;
  stats.goalCount = goalIds.size;
  stats.habitCount = habitIds.size;
  stats.routineCount = routineIds.size;
  stats.blockCount = blockIds.size;
  stats.focusSessionCount = focusSessionIds.size;
  stats.decisionRecordCount = decisionRecordIds.size;

  // 2. Validate Referential Integrity (Warn instead of silently deleting)
  if (Array.isArray(state.tasks)) {
    for (const t of state.tasks) {
      if (!t.title || typeof t.title !== 'string' || t.title.trim() === '') {
        warnings.push(`Task "${t.id}" has an empty or invalid title.`);
      }
      if (t.priority && !['critical', 'important', 'normal'].includes(t.priority)) {
        errors.push(`Task "${t.id}" has an invalid priority value: "${t.priority}".`);
      }
      if (t.projectId && !projectIds.has(t.projectId)) {
        warnings.push(`Task "${t.title || t.id}" (${t.id}) references missing project "${t.projectId}".`);
      }
      if (Array.isArray(t.blockedBy)) {
        for (const depId of t.blockedBy) {
          if (!taskIds.has(depId)) {
            warnings.push(`Task "${t.title || t.id}" depends on missing prerequisite task "${depId}".`);
          }
        }
      }
      if (t.estimatedMinutes !== undefined && (typeof t.estimatedMinutes !== 'number' || t.estimatedMinutes < 0)) {
        errors.push(`Task "${t.id}" has an invalid negative estimatedMinutes: ${t.estimatedMinutes}.`);
      }
    }
  }

  if (Array.isArray(state.projects)) {
    for (const p of state.projects) {
      if (!p.name || typeof p.name !== 'string') {
        warnings.push(`Project "${p.id}" has an invalid name.`);
      }
      if (p.status && !['active', 'completed', 'archived'].includes(p.status)) {
        errors.push(`Project "${p.id}" has an invalid status: "${p.status}".`);
      }
      if (p.goalId && !goalIds.has(p.goalId)) {
        warnings.push(`Project "${p.name || p.id}" references missing goal "${p.goalId}".`);
      }
    }
  }

  if (Array.isArray(state.goals)) {
    for (const g of state.goals) {
      if (Array.isArray(g.projectIds)) {
        for (const pid of g.projectIds) {
          if (!projectIds.has(pid)) {
            warnings.push(`Goal "${g.title || g.id}" references missing project "${pid}".`);
          }
        }
      }
    }
  }

  if (Array.isArray(state.schedule)) {
    for (const b of state.schedule) {
      if (typeof b.start !== 'number' || typeof b.end !== 'number') {
        errors.push(`Schedule block "${b.id}" has non-numeric start or end time.`);
      } else if (b.start > b.end) {
        errors.push(`Schedule block "${b.title || b.id}" has start (${b.start}) greater than end (${b.end}).`);
      } else if (b.start < 0 || b.end < 0) {
        errors.push(`Schedule block "${b.title || b.id}" has negative time parameters.`);
      }
      if (b.taskId && !taskIds.has(b.taskId)) {
        warnings.push(`Schedule block "${b.title || b.id}" references missing task "${b.taskId}".`);
      }
    }
  }

  if (Array.isArray(state.focusSessions)) {
    for (const fs of state.focusSessions) {
      if (fs.durationMinutes !== undefined && fs.durationMinutes < 0) {
        errors.push(`Focus session "${fs.id}" has negative duration: ${fs.durationMinutes}.`);
      }
      if (fs.startedAt && fs.endedAt && fs.endedAt < fs.startedAt) {
        errors.push(`Focus session "${fs.id}" has endedAt earlier than startedAt.`);
      }
      if (fs.taskId && !taskIds.has(fs.taskId)) {
        warnings.push(`Focus session "${fs.id}" references missing task "${fs.taskId}".`);
      }
    }
  }

  if (Array.isArray(state.habitCompletions)) {
    for (const hc of state.habitCompletions) {
      if (hc.habitId && !habitIds.has(hc.habitId)) {
        warnings.push(`Habit completion "${hc.id}" references missing habit "${hc.habitId}".`);
      }
      if (hc.dateKey && !/^\d{4}-\d{2}-\d{2}$/.test(hc.dateKey)) {
        errors.push(`Habit completion "${hc.id}" has invalid dateKey format: "${hc.dateKey}".`);
      }
    }
  }

  if (Array.isArray(state.dailyReviews)) {
    for (const dr of state.dailyReviews) {
      if (dr.dateKey && !/^\d{4}-\d{2}-\d{2}$/.test(dr.dateKey)) {
        errors.push(`Daily review has invalid dateKey format: "${dr.dateKey}".`);
      }
      if (dr.focusMinutes !== undefined && dr.focusMinutes < 0) {
        errors.push(`Daily review for "${dr.dateKey}" has negative focusMinutes: ${dr.focusMinutes}.`);
      }
      if (dr.spentAmount !== undefined && dr.spentAmount < 0) {
        errors.push(`Daily review for "${dr.dateKey}" has negative spentAmount: ${dr.spentAmount}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

export function repairSafeDefaults(raw: any): AppState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot repair non-object state.');
  }

  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Aarav',
    scheduleInput: typeof raw.scheduleInput === 'string' ? raw.scheduleInput : '',
    schedule: Array.isArray(raw.schedule) ? raw.schedule : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    habits: Array.isArray(raw.habits) ? raw.habits : [],
    habitCompletions: Array.isArray(raw.habitCompletions) ? raw.habitCompletions : [],
    focusSessions: Array.isArray(raw.focusSessions) ? raw.focusSessions : [],
    dailyReviews: Array.isArray(raw.dailyReviews) ? raw.dailyReviews : [],
    activeTaskId: raw.activeTaskId ?? null,
    activeTaskStartedAt: raw.activeTaskStartedAt ?? null,
    activeTaskPausedAt: raw.activeTaskPausedAt ?? null,
    activeTaskAccumulatedMs: typeof raw.activeTaskAccumulatedMs === 'number' ? raw.activeTaskAccumulatedMs : 0,
    dailyBudget: typeof raw.dailyBudget === 'number' && raw.dailyBudget >= 0 ? raw.dailyBudget : 500,
    weeklyBudget: typeof raw.weeklyBudget === 'number' && raw.weeklyBudget >= 0 ? raw.weeklyBudget : 3500,
    monthlyBudget: typeof raw.monthlyBudget === 'number' && raw.monthlyBudget >= 0 ? raw.monthlyBudget : 15000,
    reportStreak: typeof raw.reportStreak === 'number' && raw.reportStreak >= 0 ? raw.reportStreak : 0,
    workDayStart: typeof raw.workDayStart === 'number' ? raw.workDayStart : 540,
    workDayEnd: typeof raw.workDayEnd === 'number' ? raw.workDayEnd : 1260,
    planningPreferences: raw.planningPreferences || {
      deepWorkWindow: { start: 9 * 60, end: 12 * 60 },
      lightWorkWindow: { start: 14 * 60, end: 17 * 60 },
      personalWindow: { start: 19 * 60, end: 24 * 60 },
      useHistoricalEstimateAdjustment: false,
    },
    adaptiveProposals: Array.isArray(raw.adaptiveProposals) ? raw.adaptiveProposals : [],
    weeklyPlanConfirmed: typeof raw.weeklyPlanConfirmed === 'boolean' ? raw.weeklyPlanConfirmed : false,
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    recurringTasks: Array.isArray(raw.recurringTasks) ? raw.recurringTasks : [],
    routines: Array.isArray(raw.routines) ? raw.routines : [],
    personalPreferences: Array.isArray(raw.personalPreferences) ? raw.personalPreferences : [],
    decisionRecords: Array.isArray(raw.decisionRecords) ? raw.decisionRecords : [],
    taskTemplates: Array.isArray(raw.taskTemplates) ? raw.taskTemplates : [],
    notificationPreferences: raw.notificationPreferences || {
      enabled: true,
      taskReminders: true,
      deadlineReminders: true,
      routineReminders: true,
      weeklyReviewReminder: true,
      quietHours: { start: 22 * 60 + 30, end: 7 * 60 },
    },
    localNotifications: Array.isArray(raw.localNotifications) ? raw.localNotifications : [],
    calendarSync: raw.calendarSync || {
      status: 'never_synced',
      importedEventCount: 0,
    },
    externalCalendarEvents: Array.isArray(raw.externalCalendarEvents) ? raw.externalCalendarEvents : [],
    onboardingCompleted: typeof raw.onboardingCompleted === 'boolean' ? raw.onboardingCompleted : true,
  };
}
