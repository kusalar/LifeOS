import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppState, ExpenseCategory, Priority, Reminder, Task } from '../types';
import { uid } from './dates';
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
  addTask: (task: { title: string; priority: Priority; dueTs: number; tag?: string; note?: string }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
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
          // Migration check for budget fields and priorities
          if (!parsed.dailyBudget) parsed.dailyBudget = 400;
          if (!parsed.weeklyBudget) parsed.weeklyBudget = 2800;
          if (!parsed.monthlyBudget) parsed.monthlyBudget = 12000;
          if (parsed.tasks && parsed.tasks.length > 0 && !parsed.tasks[0].priority) {
            parsed.tasks = parsed.tasks.map((t: any) => ({
              ...t,
              priority: t.tag === 'Exam' ? 'critical' : t.tag === 'College' ? 'important' : 'normal',
              dueTs: t.dueTs || Date.now(),
              createdAt: t.createdAt || Date.now(),
            }));
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
                    done: false,
                    createdAt: Date.now(),
                  },
                  ...s.tasks,
                ],
              }
            : s
        ),
      updateTask: (id: string, updates: Partial<Task>) =>
        setState((s) =>
          s
            ? {
                ...s,
                tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
              }
            : s
        ),
      deleteTask: (id: string) =>
        setState((s) => (s ? { ...s, tasks: s.tasks.filter((t) => t.id !== id) } : s)),
      toggleTask: (id: string) =>
        setState((s) => (s ? { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } : s)),
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

// --- UI-level context (global sheets) ---------------------------------------

interface UICtx {
  openAsk: () => void;
  openExpense: () => void;
  openTask: (taskToEdit?: Task) => void;
  openReminder: () => void;
  openNowModal: () => void;
}

export const UIContext = createContext<UICtx>({
  openAsk: () => {},
  openExpense: () => {},
  openTask: () => {},
  openReminder: () => {},
  openNowModal: () => {},
});

export function useUI(): UICtx {
  return useContext(UIContext);
}
