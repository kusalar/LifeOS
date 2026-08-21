import { useEffect, useState } from 'react';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function fmtTime(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtDateLong(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const datePart = fmtDateShort(ts);
  const timePart = fmtClock(ts);
  if (isToday(ts)) return `Today at ${timePart}`;
  if (isTomorrow(ts)) return `Tomorrow at ${timePart}`;
  return `${datePart}, ${timePart}`;
}

export function dayName(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long' });
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  return d;
}

export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function isTomorrow(ts: number): boolean {
  const d = new Date(ts);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
}

export function isPast(ts: number): boolean {
  return ts < Date.now();
}

export function isOverdueDay(ts: number): boolean {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

export function daysUntil(ts: number): number {
  const a = startOfToday().getTime();
  const b = new Date(ts);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a) / 86400000);
}

export function dueLabel(ts: number): string {
  const n = daysUntil(ts);
  if (n < -1) return `${Math.abs(n)}d overdue`;
  if (n === -1) return 'Yesterday (overdue)';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n <= 7) return `In ${n} days (${dayName(ts).slice(0, 3)})`;
  return `In ${n} days`;
}

export function nowMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function addDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

export function atTime(daysFromNow: number, mins: number): number {
  const d = addDays(daysFromNow);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}

export function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Winding down';
}

export function useNow(intervalMs: number = 30000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Natural language parser for quick reminder / task text
 * e.g. "Pay electricity bill tomorrow at 8pm" -> title: "Pay electricity bill", dueTs
 */
export function parseNLDateTime(input: string): { title: string; dueTs: number; detectedDateStr: string } {
  const s = input.trim();
  let clean = s;
  let targetDate = new Date();
  let detectedDateStr = 'Today';
  let targetMins = 18 * 60; // Default to 6:00 PM

  // Check day offsets
  if (/\btomorrow\b/i.test(s)) {
    targetDate = addDays(1);
    detectedDateStr = 'Tomorrow';
    clean = clean.replace(/\btomorrow\b/i, '');
  } else if (/\bday after tomorrow\b/i.test(s)) {
    targetDate = addDays(2);
    detectedDateStr = 'In 2 days';
    clean = clean.replace(/\bday after tomorrow\b/i, '');
  } else if (/\bin (\d+) days?\b/i.test(s)) {
    const m = s.match(/\bin (\d+) days?\b/i);
    if (m) {
      const d = parseInt(m[1], 10);
      targetDate = addDays(d);
      detectedDateStr = `In ${d} days`;
      clean = clean.replace(/\bin \d+ days?\b/i, '');
    }
  } else if (/\bnext week\b/i.test(s)) {
    targetDate = addDays(7);
    detectedDateStr = 'Next week';
    clean = clean.replace(/\bnext week\b/i, '');
  } else if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(s)) {
    const dowNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const match = s.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (match) {
      const targetDow = dowNames.indexOf(match[1].toLowerCase());
      const currentDow = new Date().getDay();
      let diff = targetDow - currentDow;
      if (diff <= 0) diff += 7;
      targetDate = addDays(diff);
      detectedDateStr = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      clean = clean.replace(new RegExp(`\\b(on |this |next )?${match[1]}\\b`, 'i'), '');
    }
  }

  // Check time
  const timeMatch = s.match(/\b(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const mer = timeMatch[3]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (!mer && h <= 6) h += 12; // "at 5" -> 5 PM
    targetMins = h * 60 + m;
    clean = clean.replace(timeMatch[0], '');
  } else if (/\bmorning\b/i.test(s)) {
    targetMins = 9 * 60;
    clean = clean.replace(/\b(in the )?morning\b/i, '');
  } else if (/\bafternoon\b/i.test(s)) {
    targetMins = 14 * 60;
    clean = clean.replace(/\b(in the )?afternoon\b/i, '');
  } else if (/\bevening\b/i.test(s)) {
    targetMins = 19 * 60;
    clean = clean.replace(/\b(in the )?evening\b/i, '');
  } else if (/\btonight\b/i.test(s)) {
    targetMins = 21 * 60;
    clean = clean.replace(/\btonight\b/i, '');
  }

  targetDate.setHours(Math.floor(targetMins / 60), targetMins % 60, 0, 0);

  // Clean title
  let finalTitle = clean
    .replace(/\b(remind me to|remember to|need to|have to|dont forget to|don't forget to|by|at|on)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!finalTitle) finalTitle = s;
  finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);

  return {
    title: finalTitle,
    dueTs: targetDate.getTime(),
    detectedDateStr: `${detectedDateStr} at ${fmtTime(targetMins)}`,
  };
}
