import type { LocalNotification, NotificationPreferences } from '../types';

export interface NotificationService {
  requestPermission(): Promise<boolean>;
  schedule(notification: LocalNotification): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<LocalNotification[]>;
  hasPermission(): Promise<boolean>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  taskReminders: true,
  deadlineReminders: true,
  routineReminders: true,
  weeklyReviewReminder: true,
  quietHours: {
    start: 22 * 60 + 30, // 22:30
    end: 7 * 60,         // 07:00
  },
};

export class SafeLocalNotificationService implements NotificationService {
  private permissionGranted: boolean = true;
  private scheduledStore: Map<string, LocalNotification> = new Map();

  async requestPermission(): Promise<boolean> {
    // In platform-safe local mode, simulate permission request
    this.permissionGranted = true;
    return this.permissionGranted;
  }

  async hasPermission(): Promise<boolean> {
    return this.permissionGranted;
  }

  setPermission(granted: boolean): void {
    this.permissionGranted = granted;
  }

  async schedule(notification: LocalNotification): Promise<string> {
    if (!this.permissionGranted) {
      throw new Error('Notification permission denied by device.');
    }
    const id = notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const savedNotification: LocalNotification = {
      ...notification,
      id,
      status: 'scheduled',
      createdAt: notification.createdAt || Date.now(),
    };
    this.scheduledStore.set(id, savedNotification);
    return id;
  }

  async cancel(notificationId: string): Promise<void> {
    const existing = this.scheduledStore.get(notificationId);
    if (existing) {
      this.scheduledStore.set(notificationId, { ...existing, status: 'cancelled' });
    }
  }

  async cancelAll(): Promise<void> {
    for (const [id, notif] of this.scheduledStore.entries()) {
      this.scheduledStore.set(id, { ...notif, status: 'cancelled' });
    }
  }

  async getScheduled(): Promise<LocalNotification[]> {
    return Array.from(this.scheduledStore.values()).filter((n) => n.status === 'scheduled');
  }

  getScheduledNotifications(): LocalNotification[] {
    return Array.from(this.scheduledStore.values()).filter((n) => n.status === 'scheduled');
  }
}

export const localNotificationService: NotificationService & { setPermission: (g: boolean) => void } =
  new SafeLocalNotificationService();
