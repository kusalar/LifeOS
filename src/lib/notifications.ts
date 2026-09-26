import type {
  LocalNotification,
  NotificationPreferences,
  NotificationReconciliationResult,
} from '../types';

export interface NotificationService {
  requestPermission(): Promise<boolean>;
  schedule(notification: LocalNotification): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<LocalNotification[]>;
  hasPermission(): Promise<boolean>;
  reconcile?(desired: LocalNotification[]): Promise<NotificationReconciliationResult>;
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

/**
 * Deterministic notification ID generator according to LifeOS V5 specs:
 * lifeos-task-{taskId}-{timestamp}
 * lifeos-deadline-{taskId}-{timestamp}
 * lifeos-routine-{routineId}-{timestamp}
 * lifeos-weekly-review-{timestamp}
 */
export function getStableNotificationId(
  type: 'task' | 'deadline' | 'routine' | 'reminder' | 'focus' | 'weekly_review',
  sourceId: string,
  scheduledAt: number
): string {
  if (type === 'weekly_review') {
    return `lifeos-weekly-review-${scheduledAt}`;
  }
  return `lifeos-${type}-${sourceId}-${scheduledAt}`;
}

/**
 * Reconciles desired notifications against currently scheduled notifications:
 * - Schedule Missing
 * - Cancel Obsolete
 * - Preserve Valid
 */
export function reconcileNotifications(
  desiredNotifications: LocalNotification[],
  currentlyScheduled: LocalNotification[]
): NotificationReconciliationResult {
  const desiredMap = new Map<string, LocalNotification>();
  for (const n of desiredNotifications) {
    if (n.id) {
      desiredMap.set(n.id, n);
    }
  }

  const scheduledMap = new Map<string, LocalNotification>();
  for (const s of currentlyScheduled) {
    if (s.id && s.status === 'scheduled') {
      scheduledMap.set(s.id, s);
    }
  }

  const scheduledIds: string[] = [];
  const cancelledIds: string[] = [];
  const preservedIds: string[] = [];

  // Identify preserved and missing (to schedule)
  for (const [id] of desiredMap.entries()) {
    if (scheduledMap.has(id)) {
      preservedIds.push(id);
    } else {
      scheduledIds.push(id);
    }
  }

  // Identify obsolete (to cancel)
  for (const id of scheduledMap.keys()) {
    if (!desiredMap.has(id)) {
      cancelledIds.push(id);
    }
  }

  return {
    scheduledCount: scheduledIds.length,
    cancelledCount: cancelledIds.length,
    preservedCount: preservedIds.length,
    scheduledIds,
    cancelledIds,
    preservedIds,
  };
}

export class SafeLocalNotificationService implements NotificationService {
  private permissionGranted: boolean = true;
  private scheduledStore: Map<string, LocalNotification> = new Map();

  async requestPermission(): Promise<boolean> {
    // If permission was explicitly revoked, maintain it; otherwise default true
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

  async reconcile(desired: LocalNotification[]): Promise<NotificationReconciliationResult> {
    const scheduled = await this.getScheduled();
    const result = reconcileNotifications(desired, scheduled);

    for (const cancelId of result.cancelledIds) {
      await this.cancel(cancelId);
    }

    if (this.permissionGranted) {
      for (const notif of desired) {
        if (result.scheduledIds.includes(notif.id)) {
          await this.schedule(notif);
        }
      }
    }

    return result;
  }
}

export const localNotificationService: SafeLocalNotificationService =
  new SafeLocalNotificationService();

