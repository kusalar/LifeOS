import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AppState,
  DailyReview,
  ExpenseCategory,
  FocusSession,
  Habit,
  HabitCompletion,
  Priority,
  Project,
  ProjectStatus,
  Reminder,
  Task,
} from '../types';
import { localDateKey, uid } from './dates';
import { buildSchedule, parsePlan } from './engine';
import { makeSeed } from './seed';

const KEY = 'lifeos-state-v2';

interface StoreCtx {
  state: AppState | null;
  ready: boolean;
  generateSchedule: (input: string) => void;
  toggleBlock: (id: string) => void;
  addExpense: (amount: number, category: ExpenseCategory, note: string) => void;
  deleteExpense: (id: string) => void;
  addTask: (task: {
    title: string;
    priority: Priority;
    dueTs: number;
    tag?: string;
    note?: string;
    projectId?: string;
    estimatedMinutes?: number;
  }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  addProject: (project: {
    name: string;
    description?: string;
    deadline?: number;
    color?: string;
    icon?: string;
    status?: ProjectStatus;
  }) => string;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  archiveProject: (id: string) => void;
  startTask: (id: string) => void;
  pauseTask: () => void;
  resumeTask: () => void;
  stopActiveTask: () => void;
  completeActiveTask: () => void;
  addHabit: (habit: { name: string; description?: string; color?: string; icon?: string }) => string;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  toggleHabit: (id: string, dateKey?: string) => void;
  deactivateHabit: (id: string) => void;
  reactivateHabit: (id: string) => void;
  saveDailyReview: (review: Partial<DailyReview> & { dateKey: string }) => void;
  addReminder: (title: string, dueTs: number, source?: string, priority?: Priority) => void;
  rememberReminder: (id: string) => void;
  dismissReminder: (id: string) => void;
  completeReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  updateBudget: (budgets: { dailyBudget?: number; weeklyBudget?: number; monthlyBudget?: number }) => void;
  resetDemo: () => void;
}

const Ctx = createContext<StoreCtx>({
  state: null,
  ready: false,
  generateSchedule: () => {},
  toggleBlock: () => {},
  addExpense: () => {},
  deleteExpense: () => {},
  addTask: () => {},
  updateTask: () => {},
  deleteTask: () => {},
  toggleTask: () => {},
  addProject: () => '',
  updateProject: () => {},
  deleteProject: () => {},
  archiveProject: () => {},
  startTask: () => {},
  pauseTask: () => {},
  resumeTask: () => {},
  stopActiveTask: () => {},
  completeActiveTask: () => {},
  addHabit: () => '',
  updateHabit: () => {},
  toggleHabit: () => {},
  deactivateHabit: () => {},
  reactivateHabit: () => {},
  saveDailyReview: () => {},
  addReminder: () => {},
  rememberReminder: () => {},
  dismissReminder: () => {},
  completeReminder: () => {},
  deleteReminder: () => {},
  updateBudget: () => {},
  resetDemo: () => {},
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Migration check using nullish-coalescing (value ?? default)
          parsed.dailyBudget = parsed.dailyBudget ?? 400;
          parsed.weeklyBudget = parsed.weeklyBudget ?? 2800;
          parsed.monthlyBudget = parsed.monthlyBudget ?? 12000;
          parsed.workDayStart = parsed.workDayStart ?? 9 * 60;
          parsed.workDayEnd = parsed.workDayEnd ?? 21 * 60;
          parsed.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
          parsed.habits = Array.isArray(parsed.habits) ? parsed.habits : [];
          parsed.habitCompletions = Array.isArray(parsed.habitCompletions) ? parsed.habitCompletions : [];
          parsed.focusSessions = Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [];
          parsed.dailyReviews = Array.isArray(parsed.dailyReviews) ? parsed.dailyReviews : [];
          parsed.activeTaskId = parsed.activeTaskId ?? null;
          parsed.activeTaskStartedAt = parsed.activeTaskStartedAt ?? null;
          parsed.activeTaskPausedAt = parsed.activeTaskPausedAt ?? null;
          parsed.activeTaskAccumulatedMs = parsed.activeTaskAccumulatedMs ?? 0;

          if (parsed.tasks && parsed.tasks.length > 0) {
            parsed.tasks = parsed.tasks.map((t: any) => ({
              ...t,
              priority: t.priority || (t.tag === 'Exam' ? 'critical' : t.tag === 'College' ? 'important' : 'normal'),
              dueTs: t.dueTs || Date.now(),
              createdAt: t.createdAt || Date.now(),
            }));
          }

          // Harden: ensure activeTaskId references a valid, incomplete task
          if (parsed.activeTaskId) {
            const activeExists = parsed.tasks?.find((t: any) => t.id === parsed.activeTaskId && !t.done);
            if (!activeExists) {
              parsed.activeTaskId = null;
              parsed.activeTaskStartedAt = null;
              parsed.activeTaskPausedAt = null;
              parsed.activeTaskAccumulatedMs = 0;
            }
          }

          setState(parsed);
          setReady(true);
          return;
        }
      } catch {}
      const seed = makeSeed();
      setState(seed);
      setReady(true);
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(seed));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (state) {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }
  }, [state]);

  const value = useMemo<StoreCtx>(
    () => ({
      state,
      ready,
      generateSchedule: (input: string) =>
        setState((s) => (s ? { ...s, scheduleInput: input, schedule: buildSchedule(parsePlan(input)) } : s)),
      toggleBlock: (id: string) =>
        setState((s) =>
          s ? { ...s, schedule: s.schedule.map((b) => (b.id === id ? { ...b, done: !b.done } : b)) } : s
        ),
      addExpense: (amount: number, category: ExpenseCategory, note: string) =>
        setState((s) =>
          s
            ? {
                ...s,
                expenses: [{ id: uid(), amount, category, note, ts: Date.now() }, ...s.expenses],
              }
            : s
        ),
      deleteExpense: (id: string) =>
        setState((s) => (s ? { ...s, expenses: s.expenses.filter((e) => e.id !== id) } : s)),
      addTask: (taskData) =>
        setState((s) =>
          s
            ? {
                ...s,
                tasks: [
                  {
                    id: uid(),
                    title: taskData.title,
                    priority: taskData.priority,
                    dueTs: taskData.dueTs,
                    tag: taskData.tag || 'General',
                    note: taskData.note,
                    projectId: taskData.projectId,
                    estimatedMinutes: taskData.estimatedMinutes,
                    done: false,
                    createdAt: Date.now(),
                  },
                  ...s.tasks,
                ],
              }
            : s
        ),
      updateTask: (id: string, updates: Partial<Task>) =>
        setState((s) => {
          if (!s) return s;
          const willBeDone = updates.done === true;
          return {
            ...s,
            activeTaskId: s.activeTaskId === id && willBeDone ? null : s.activeTaskId,
            activeTaskStartedAt: s.activeTaskId === id && willBeDone ? null : s.activeTaskStartedAt,
            activeTaskPausedAt: s.activeTaskId === id && willBeDone ? null : s.activeTaskPausedAt,
            activeTaskAccumulatedMs: s.activeTaskId === id && willBeDone ? 0 : s.activeTaskAccumulatedMs,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          };
        }),
      deleteTask: (id: string) =>
        setState((s) =>
          s
            ? {
                ...s,
                activeTaskId: s.activeTaskId === id ? null : s.activeTaskId,
                activeTaskStartedAt: s.activeTaskId === id ? null : s.activeTaskStartedAt,
                activeTaskPausedAt: s.activeTaskId === id ? null : s.activeTaskPausedAt,
                activeTaskAccumulatedMs: s.activeTaskId === id ? 0 : s.activeTaskAccumulatedMs,
                tasks: s.tasks.filter((t) => t.id !== id),
              }
            : s
        ),
      toggleTask: (id: string) =>
        setState((s) => {
          if (!s) return s;
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const willBeDone = !task.done;
          let newSessions = s.focusSessions;

          // If completing the active task, record focus session
          if (s.activeTaskId === id && willBeDone) {
            const now = Date.now();
            const elapsedSinceStart = s.activeTaskStartedAt ? now - s.activeTaskStartedAt : 0;
            const totalMs = (s.activeTaskAccumulatedMs ?? 0) + elapsedSinceStart;
            const durationMinutes = Math.max(1, Math.round(totalMs / 60000));
            newSessions = [
              {
                id: 'focus-' + uid(),
                taskId: id,
                projectId: task.projectId,
                startedAt: now - totalMs,
                endedAt: now,
                durationMinutes,
                completed: true,
              },
              ...s.focusSessions,
            ];
          }

          return {
            ...s,
            activeTaskId: s.activeTaskId === id && willBeDone ? null : s.activeTaskId,
            activeTaskStartedAt: s.activeTaskId === id && willBeDone ? null : s.activeTaskStartedAt,
            activeTaskPausedAt: s.activeTaskId === id && willBeDone ? null : s.activeTaskPausedAt,
            activeTaskAccumulatedMs: s.activeTaskId === id && willBeDone ? 0 : s.activeTaskAccumulatedMs,
            focusSessions: newSessions,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: willBeDone } : t)),
          };
        }),
      addProject: (projectData) => {
        const newId = 'proj-' + uid();
        const now = Date.now();
        setState((s) =>
          s
            ? {
                ...s,
                projects: [
                  {
                    id: newId,
                    name: projectData.name,
                    description: projectData.description,
                    deadline: projectData.deadline,
                    color: projectData.color || '#60A5FA',
                    icon: projectData.icon || 'folder-outline',
                    status: projectData.status || 'active',
                    createdAt: now,
                    updatedAt: now,
                  },
                  ...s.projects,
                ],
              }
            : s
        );
        return newId;
      },
      updateProject: (id: string, updates: Partial<Project>) =>
        setState((s) =>
          s
            ? {
                ...s,
                projects: s.projects.map((p) =>
                  p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
                ),
              }
            : s
        ),
      deleteProject: (id: string) =>
        setState((s) => {
          if (!s) return s;
          const updatedTasks = s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t));
          return {
            ...s,
            projects: s.projects.filter((p) => p.id !== id),
            tasks: updatedTasks,
          };
        }),
      archiveProject: (id: string) =>
        setState((s) =>
          s
            ? {
                ...s,
                projects: s.projects.map((p) =>
                  p.id === id ? { ...p, status: 'archived', updatedAt: Date.now() } : p
                ),
              }
            : s
        ),

      // Focus Mode Session Management
      startTask: (id: string) =>
        setState((s) => {
          if (!s) return s;
          const targetTask = s.tasks.find((t) => t.id === id);
          if (!targetTask || targetTask.done) return s;

          const now = Date.now();
          let newSessions = s.focusSessions;

          // If another task was previously active and had elapsed time >= 1 min, flush it
          if (s.activeTaskId && s.activeTaskId !== id) {
            const previousTask = s.tasks.find((t) => t.id === s.activeTaskId);
            const elapsedSinceStart = s.activeTaskStartedAt ? now - s.activeTaskStartedAt : 0;
            const totalMs = (s.activeTaskAccumulatedMs ?? 0) + elapsedSinceStart;
            if (totalMs >= 60000 && previousTask) {
              const durationMinutes = Math.max(1, Math.round(totalMs / 60000));
              newSessions = [
                {
                  id: 'focus-' + uid(),
                  taskId: previousTask.id,
                  projectId: previousTask.projectId,
                  startedAt: now - totalMs,
                  endedAt: now,
                  durationMinutes,
                  completed: false,
                },
                ...s.focusSessions,
              ];
            }
          }

          return {
            ...s,
            activeTaskId: id,
            activeTaskStartedAt: now,
            activeTaskPausedAt: null,
            activeTaskAccumulatedMs: 0,
            focusSessions: newSessions,
          };
        }),
      pauseTask: () =>
        setState((s) => {
          if (!s || !s.activeTaskId || !s.activeTaskStartedAt) return s;
          const now = Date.now();
          const elapsed = now - s.activeTaskStartedAt;
          return {
            ...s,
            activeTaskAccumulatedMs: (s.activeTaskAccumulatedMs ?? 0) + elapsed,
            activeTaskStartedAt: null,
            activeTaskPausedAt: now,
          };
        }),
      resumeTask: () =>
        setState((s) => {
          if (!s || !s.activeTaskId || !s.activeTaskPausedAt) return s;
          return {
            ...s,
            activeTaskStartedAt: Date.now(),
            activeTaskPausedAt: null,
          };
        }),
      stopActiveTask: () =>
        setState((s) => {
          if (!s || !s.activeTaskId) return s;
          const now = Date.now();
          const task = s.tasks.find((t) => t.id === s.activeTaskId);
          const elapsedSinceStart = s.activeTaskStartedAt ? now - s.activeTaskStartedAt : 0;
          const totalMs = (s.activeTaskAccumulatedMs ?? 0) + elapsedSinceStart;

          let newSessions = s.focusSessions;
          if (totalMs >= 60000 && task) {
            const durationMinutes = Math.max(1, Math.round(totalMs / 60000));
            newSessions = [
              {
                id: 'focus-' + uid(),
                taskId: task.id,
                projectId: task.projectId,
                startedAt: now - totalMs,
                endedAt: now,
                durationMinutes,
                completed: false,
              },
              ...s.focusSessions,
            ];
          }

          return {
            ...s,
            activeTaskId: null,
            activeTaskStartedAt: null,
            activeTaskPausedAt: null,
            activeTaskAccumulatedMs: 0,
            focusSessions: newSessions,
          };
        }),
      completeActiveTask: () =>
        setState((s) => {
          if (!s || !s.activeTaskId) return s;
          const now = Date.now();
          const task = s.tasks.find((t) => t.id === s.activeTaskId);
          if (!task) return s;

          const elapsedSinceStart = s.activeTaskStartedAt ? now - s.activeTaskStartedAt : 0;
          const totalMs = (s.activeTaskAccumulatedMs ?? 0) + elapsedSinceStart;
          const durationMinutes = Math.max(1, Math.round(totalMs / 60000));

          const newSession: FocusSession = {
            id: 'focus-' + uid(),
            taskId: task.id,
            projectId: task.projectId,
            startedAt: now - totalMs,
            endedAt: now,
            durationMinutes,
            completed: true,
          };

          return {
            ...s,
            activeTaskId: null,
            activeTaskStartedAt: null,
            activeTaskPausedAt: null,
            activeTaskAccumulatedMs: 0,
            focusSessions: [newSession, ...s.focusSessions],
            tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t)),
          };
        }),

      // Habit System Operations
      addHabit: (habitData) => {
        const newId = 'habit-' + uid();
        setState((s) =>
          s
            ? {
                ...s,
                habits: [
                  {
                    id: newId,
                    name: habitData.name,
                    description: habitData.description,
                    frequency: 'daily',
                    targetPerPeriod: 1,
                    createdAt: Date.now(),
                    active: true,
                    color: habitData.color || '#A78BFA',
                    icon: habitData.icon || 'checkmark-circle-outline',
                  },
                  ...s.habits,
                ],
              }
            : s
        );
        return newId;
      },
      updateHabit: (id: string, updates: Partial<Habit>) =>
        setState((s) =>
          s
            ? {
                ...s,
                habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
              }
            : s
        ),
      toggleHabit: (id: string, dateKey?: string) =>
        setState((s) => {
          if (!s) return s;
          const key = dateKey ?? localDateKey();
          const alreadyCompleted = s.habitCompletions.some(
            (c) => c.habitId === id && c.dateKey === key
          );

          if (alreadyCompleted) {
            // Remove completion
            return {
              ...s,
              habitCompletions: s.habitCompletions.filter(
                (c) => !(c.habitId === id && c.dateKey === key)
              ),
            };
          } else {
            // Add completion (single per day)
            const newCompletion: HabitCompletion = {
              id: 'hc-' + uid(),
              habitId: id,
              dateKey: key,
              completedAt: Date.now(),
            };
            return {
              ...s,
              habitCompletions: [newCompletion, ...s.habitCompletions],
            };
          }
        }),
      deactivateHabit: (id: string) =>
        setState((s) =>
          s
            ? {
                ...s,
                habits: s.habits.map((h) => (h.id === id ? { ...h, active: false } : h)),
              }
            : s
        ),
      reactivateHabit: (id: string) =>
        setState((s) =>
          s
            ? {
                ...s,
                habits: s.habits.map((h) => (h.id === id ? { ...h, active: true } : h)),
              }
            : s
        ),

      // Daily Review Operations
      saveDailyReview: (reviewData) =>
        setState((s) => {
          if (!s) return s;
          const now = Date.now();
          const existingIdx = s.dailyReviews.findIndex((r) => r.dateKey === reviewData.dateKey);

          if (existingIdx >= 0) {
            const updated = [...s.dailyReviews];
            updated[existingIdx] = {
              ...updated[existingIdx],
              ...reviewData,
              updatedAt: now,
            };
            return { ...s, dailyReviews: updated };
          } else {
            const newReview: DailyReview = {
              dateKey: reviewData.dateKey,
              completedTasks: reviewData.completedTasks ?? 0,
              completedHabits: reviewData.completedHabits ?? 0,
              focusMinutes: reviewData.focusMinutes ?? 0,
              plannedMinutes: reviewData.plannedMinutes ?? 0,
              spentAmount: reviewData.spentAmount ?? 0,
              mood: reviewData.mood,
              reflection: reviewData.reflection,
              createdAt: now,
              updatedAt: now,
            };
            return { ...s, dailyReviews: [newReview, ...s.dailyReviews] };
          }
        }),

      addReminder: (title: string, dueTs: number, source = 'Direct Reminder', priority: Priority = 'normal') =>
        setState((s) =>
          s
            ? {
                ...s,
                reminders: [
                  {
                    id: uid(),
                    title,
                    source,
                    dueTs,
                    status: 'tracked',
                    priority,
                    icon: 'notifications-outline',
                  },
                  ...s.reminders,
                ],
              }
            : s
        ),
      rememberReminder: (id: string) =>
        setState((s) =>
          s ? { ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, status: 'tracked' } : r)) } : s
        ),
      dismissReminder: (id: string) =>
        setState((s) => (s ? { ...s, reminders: s.reminders.filter((r) => r.id !== id) } : s)),
      completeReminder: (id: string) =>
        setState((s) =>
          s ? { ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, status: 'done' } : r)) } : s
        ),
      deleteReminder: (id: string) =>
        setState((s) => (s ? { ...s, reminders: s.reminders.filter((r) => r.id !== id) } : s)),
      updateBudget: (budgets: { dailyBudget?: number; weeklyBudget?: number; monthlyBudget?: number }) =>
        setState((s) => (s ? { ...s, ...budgets } : s)),
      resetDemo: () => {
        const seed = makeSeed();
        setState(seed);
      },
    }),
    [state, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  return useContext(Ctx);
}

// --- UI-level context (global sheets & modals) -----------------------------

interface UICtx {
  openAsk: () => void;
  openExpense: () => void;
  openTask: (taskToEdit?: Task, defaultProjectId?: string) => void;
  openReminder: () => void;
  openNowModal: () => void;
  openProject: (projectToEdit?: Project) => void;
  openFocusModal: (taskId?: string) => void;
  openHabitSheet: (habitToEdit?: Habit) => void;
  openReviewModal: (dateKey?: string) => void;
  openHabitsModal: () => void;
}

export const UIContext = createContext<UICtx>({
  openAsk: () => {},
  openExpense: () => {},
  openTask: () => {},
  openReminder: () => {},
  openNowModal: () => {},
  openProject: () => {},
  openFocusModal: () => {},
  openHabitSheet: () => {},
  openReviewModal: () => {},
  openHabitsModal: () => {},
});

export function useUI(): UICtx {
  return useContext(UIContext);
}
