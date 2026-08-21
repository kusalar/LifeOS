import type { AppState, Expense, Reminder, Task } from '../types';
import { atTime, uid } from './dates';
import { buildSchedule, parsePlan } from './engine';

export const SEED_INPUT =
  'I have college at 10, need to study 3 hours, buy groceries and finish my assignment.';

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
      id: uid(),
      title: 'Revise Ch. 3 — Sequential Circuits',
      priority: 'critical',
      dueTs: atTime(0, 19 * 60), // Due today
      tag: 'Exam',
      done: false,
      note: 'Focus on Flip-flops and state diagrams',
      createdAt: Date.now() - 86400000,
    },
    {
      id: uid(),
      title: 'Draft conclusion for Assignment 4',
      priority: 'critical',
      dueTs: atTime(0, 16 * 60), // Due today
      tag: 'College',
      done: false,
      note: 'Include simulation waveforms',
      createdAt: Date.now() - 43200000,
    },
    {
      id: uid(),
      title: 'Reply to Prof. Mehta about capstone project',
      priority: 'important',
      dueTs: atTime(1, 12 * 60), // Tomorrow
      tag: 'Academic',
      done: false,
      note: 'Send GitHub repo link',
      createdAt: Date.now() - 36000000,
    },
    {
      id: uid(),
      title: 'Buy lab record notebook & blue pens',
      priority: 'normal',
      dueTs: atTime(1, 18 * 60),
      tag: 'Errand',
      done: false,
      createdAt: Date.now() - 20000000,
    },
    {
      id: uid(),
      title: '30 min DSA graph practice',
      priority: 'important',
      dueTs: atTime(0, 8 * 60),
      tag: 'Habit',
      done: true,
      createdAt: Date.now() - 86400000,
    },
    {
      id: uid(),
      title: 'Upload study group notes to drive',
      priority: 'normal',
      dueTs: atTime(-1, 18 * 60),
      tag: 'College',
      done: true,
      createdAt: Date.now() - 172800000,
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
    dailyBudget: 400,
    weeklyBudget: 2800,
    monthlyBudget: 12000,
    reportStreak: 6,
  };
}
