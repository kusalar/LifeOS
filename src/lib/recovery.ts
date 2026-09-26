declare const require: any;

import type { AppState, FocusSession, RecoveredFocusSession } from '../types';
import { validateAppState } from './validation';

export const PRIMARY_STORAGE_KEY = 'lifeos-state-v2';
export const BACKUP_STORAGE_KEY = 'lifeos-state-backup';
export const CORRUPTED_STORAGE_KEY = 'lifeos-state-corrupted';

export interface StorageDriver {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

const memoryStore = new Map<string, string>();

const fallbackStorage: StorageDriver = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => { memoryStore.set(key, value); },
  removeItem: (key) => { memoryStore.delete(key); },
};

let activeStorage: StorageDriver = fallbackStorage;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RNAsyncStorage = require('@react-native-async-storage/async-storage');
  if (RNAsyncStorage && (RNAsyncStorage.default || RNAsyncStorage.setItem)) {
    activeStorage = RNAsyncStorage.default || RNAsyncStorage;
  }
} catch {
  activeStorage = fallbackStorage;
}

export function setStorageDriver(driver: StorageDriver): void {
  activeStorage = driver;
}

export function getStorageDriver(): StorageDriver {
  return activeStorage;
}

let inMemoryRecoverySnapshot: AppState | null = null;
let corruptedPayloadBuffer: string | null = null;

export function setRecoverySnapshot(state: AppState): void {
  try {
    inMemoryRecoverySnapshot = JSON.parse(JSON.stringify(state));
  } catch {
    inMemoryRecoverySnapshot = state;
  }
}

export function getRecoverySnapshot(): AppState | null {
  return inMemoryRecoverySnapshot;
}

export function clearRecoverySnapshot(): void {
  inMemoryRecoverySnapshot = null;
}

export function saveCorruptedPayload(raw: string): void {
  corruptedPayloadBuffer = raw;
  try {
    activeStorage.setItem(CORRUPTED_STORAGE_KEY, raw);
  } catch {
    // Non-blocking fallback
  }
}

export function getCorruptedPayload(): string | null {
  return corruptedPayloadBuffer;
}

export function clearCorruptedPayload(): void {
  corruptedPayloadBuffer = null;
  try {
    activeStorage.removeItem(CORRUPTED_STORAGE_KEY);
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Safe write strategy:
 * 1. Validates state invariants before serializing.
 * 2. Writes to primary storage key.
 * 3. Periodically or on replacement maintains backup in secondary key.
 */
export async function safeSaveState(state: AppState, backup: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validateAppState(state);
    if (!validation.valid) {
      return {
        success: false,
        error: `Integrity check failed before write: ${validation.errors.join('; ')}`,
      };
    }

    const serialized = JSON.stringify(state);
    await activeStorage.setItem(PRIMARY_STORAGE_KEY, serialized);

    // Keep updated in-memory snapshot
    setRecoverySnapshot(state);

    if (backup) {
      await activeStorage.setItem(BACKUP_STORAGE_KEY, serialized);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to persist state: ${err.message || 'Write error'}`,
    };
  }
}

/**
 * Detects if a focus session was running when the app was closed/killed
 */
export function detectStaleFocusSession(state: AppState, now: number = Date.now()): RecoveredFocusSession | null {
  if (!state.activeTaskId || !state.activeTaskStartedAt) {
    return null;
  }

  // Active task must exist in task list
  const task = (state.tasks ?? []).find((t) => t.id === state.activeTaskId);
  const taskTitle = task ? task.title : 'Unlinked Task';

  const elapsedMs = Math.max(0, now - state.activeTaskStartedAt + (state.activeTaskAccumulatedMs ?? 0));
  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));

  return {
    taskId: state.activeTaskId,
    taskTitle,
    startedAt: state.activeTaskStartedAt,
    elapsedMinutes,
    resolved: false,
  };
}

/**
 * Resolves a recovered focus session deterministically
 */
export function resolveRecoveredFocus(
  state: AppState,
  action: 'resume' | 'complete' | 'discard',
  customMinutes?: number
): { updatedState: AppState; sessionToRecord?: FocusSession } {
  const task = (state.tasks ?? []).find((t) => t.id === state.activeTaskId);
  const duration = typeof customMinutes === 'number' && customMinutes > 0
    ? customMinutes
    : Math.max(1, Math.round(((Date.now() - (state.activeTaskStartedAt ?? Date.now())) + (state.activeTaskAccumulatedMs ?? 0)) / 60000));

  if (action === 'resume') {
    // Resume tracking from current moment
    return {
      updatedState: {
        ...state,
        activeTaskStartedAt: Date.now(),
        activeTaskPausedAt: null,
      },
    };
  }

  if (action === 'discard') {
    // Discard active session without logging duration or modifying task
    return {
      updatedState: {
        ...state,
        activeTaskId: null,
        activeTaskStartedAt: null,
        activeTaskPausedAt: null,
        activeTaskAccumulatedMs: 0,
      },
    };
  }

  // 'complete'
  const session: FocusSession = {
    id: `fs-rec-${Date.now()}`,
    taskId: state.activeTaskId || 'task',
    projectId: task?.projectId,
    startedAt: state.activeTaskStartedAt || Date.now() - duration * 60000,
    endedAt: Date.now(),
    durationMinutes: duration,
    completed: true,
  };

  const updatedTasks = (state.tasks ?? []).map((t) =>
    t.id === state.activeTaskId ? { ...t, done: true } : t
  );

  return {
    updatedState: {
      ...state,
      tasks: updatedTasks,
      focusSessions: [...(state.focusSessions ?? []), session],
      activeTaskId: null,
      activeTaskStartedAt: null,
      activeTaskPausedAt: null,
      activeTaskAccumulatedMs: 0,
    },
    sessionToRecord: session,
  };
}
