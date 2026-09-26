import type { ExternalCalendar, ExternalCalendarEvent } from '../types';

export interface CalendarProvider {
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  getCalendars(): Promise<ExternalCalendar[]>;
  getEvents(start: number, end: number): Promise<ExternalCalendarEvent[]>;
}

export class SafeLocalCalendarProvider implements CalendarProvider {
  private permissionGranted: boolean = true;
  private calendars: ExternalCalendar[] = [
    {
      id: 'cal-academic',
      name: 'College & Academic Calendar',
      color: '#3B82F6',
      source: 'Local Device',
      selected: true,
    },
    {
      id: 'cal-personal',
      name: 'Personal Calendar',
      color: '#10B981',
      source: 'Local Device',
      selected: false,
    },
  ];

  private events: ExternalCalendarEvent[] = [];

  constructor() {
    // Seed initial representative external calendar events
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).getTime();
    const todayAfternoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).getTime();

    this.events = [
      {
        id: 'evt-ece-meeting',
        calendarId: 'cal-academic',
        title: 'ECE Department Lab Session',
        start: todayMorning,
        end: todayMorning + 90 * 60000, // 10:00 - 11:30
        location: 'VLSI Lab 302',
        isAllDay: false,
      },
      {
        id: 'evt-advisor-sync',
        calendarId: 'cal-academic',
        title: 'Capstone Advisor Sync (Prof. Mehta)',
        start: todayAfternoon,
        end: todayAfternoon + 45 * 60000, // 14:00 - 14:45
        location: 'Faculty Block B',
        isAllDay: false,
      },
    ];
  }

  async requestPermission(): Promise<boolean> {
    return this.permissionGranted;
  }

  async hasPermission(): Promise<boolean> {
    return this.permissionGranted;
  }

  setPermission(granted: boolean): void {
    this.permissionGranted = granted;
  }

  async getCalendars(): Promise<ExternalCalendar[]> {
    if (!this.permissionGranted) {
      throw new Error('Calendar permission denied by device.');
    }
    return [...this.calendars];
  }

  async getEvents(start: number, end: number): Promise<ExternalCalendarEvent[]> {
    if (!this.permissionGranted) {
      throw new Error('Calendar permission denied by device.');
    }
    return this.events.filter((e) => e.start < end && e.end > start);
  }

  addEvent(event: ExternalCalendarEvent): void {
    this.events.push(event);
  }
}

export const localCalendarProvider: SafeLocalCalendarProvider = new SafeLocalCalendarProvider();
