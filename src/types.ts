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

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  dueTs: number; // timestamp
  tag?: string;
  done: boolean;
  note?: string;
  createdAt: number;
}

export interface AppState {
  name: string;
  scheduleInput: string;
  schedule: ScheduleBlock[];
  expenses: Expense[];
  reminders: Reminder[];
  tasks: Task[];
  dailyBudget: number;
  weeklyBudget: number;
  monthlyBudget: number;
  reportStreak: number;
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
  type: 'deadline' | 'overdue_task' | 'spending' | 'reminder';
  urgency: 'critical' | 'high' | 'medium';
  title: string;
  subtitle: string;
  actionText?: string;
  actionType?: 'task' | 'reminder' | 'money' | 'plan';
  targetId?: string;
}

export interface WhatToDoNowResult {
  actionTitle: string;
  category: 'Critical Task' | 'Scheduled Block' | 'Approaching Deadline' | 'Free Gap' | 'All Done';
  reason: string;
  secondaryAction?: string;
  confidence: 'High' | 'Medium';
  durationMins?: number;
  tagColor: string;
  taskId?: string;
  blockId?: string;
}
