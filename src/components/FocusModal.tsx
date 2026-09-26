import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '../lib/store';
import { alpha, C, R, S } from '../theme';
import { Btn, Chip } from './ui';

export function FocusModal({
  visible,
  onClose,
  taskId,
}: {
  visible: boolean;
  onClose: () => void;
  taskId?: string;
}) {
  const {
    state,
    startTask,
    pauseTask,
    resumeTask,
    stopActiveTask,
    completeActiveTask,
  } = useStore();

  // If a taskId was passed and nothing is running or another task is active, start it
  useEffect(() => {
    if (visible && taskId) {
      if (state && state.activeTaskId !== taskId) {
        startTask(taskId);
      }
    }
  }, [visible, taskId]);

  const activeTask = useMemo(() => {
    if (!state) return null;
    const targetId = state.activeTaskId ?? taskId;
    if (!targetId) return null;
    return state.tasks.find((t) => t.id === targetId) ?? null;
  }, [state, taskId]);

  const project = useMemo(() => {
    if (!state || !activeTask?.projectId) return null;
    return state.projects.find((p) => p.id === activeTask.projectId) ?? null;
  }, [state, activeTask]);

  // Derived state
  const isRunning = Boolean(state?.activeTaskStartedAt);
  const isPaused = Boolean(state?.activeTaskPausedAt);

  // Authoritative timestamp-derived elapsed calculation
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    if (!visible || !isRunning) return;
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, isRunning]);

  if (!state || !activeTask) {
    return null;
  }

  const accumulatedMs = state.activeTaskAccumulatedMs ?? 0;
  const runningElapsedMs = isRunning && state.activeTaskStartedAt ? Math.max(0, nowTs - state.activeTaskStartedAt) : 0;
  const totalElapsedMs = accumulatedMs + runningElapsedMs;

  const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000);
  const elapsedMinutes = Math.floor(totalElapsedSeconds / 60);
  const elapsedSecsRem = totalElapsedSeconds % 60;
  const elapsedFormatted = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSecsRem.toString().padStart(2, '0')}`;

  const estimatedMins = activeTask.estimatedMinutes ?? 0;
  const remainingMins = Math.max(0, estimatedMins - elapsedMinutes);

  const handlePause = () => {
    pauseTask();
  };

  const handleResume = () => {
    resumeTask();
  };

  const handleStop = () => {
    stopActiveTask();
    onClose();
  };

  const handleComplete = () => {
    completeActiveTask();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
          {/* Header */}
          <View style={styles.topBar}>
            <View style={styles.headerLeft}>
              <View style={[styles.pulseDot, { backgroundColor: isRunning ? C.green : C.amber }]} />
              <Text style={styles.headerTitle}>FOCUS MODE</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          {/* Main Focus Card */}
          <Animated.View entering={FadeInDown.springify()} style={styles.card}>
            {project && (
              <View style={styles.projectRow}>
                <Ionicons name="folder-outline" size={13} color={C.violet} />
                <Text style={styles.projectName} numberOfLines={1}>
                  {project.name}
                </Text>
              </View>
            )}

            <Text style={styles.taskTitle}>{activeTask.title}</Text>

            {activeTask.note ? (
              <Text style={styles.taskDesc} numberOfLines={2}>
                {activeTask.note}
              </Text>
            ) : null}

            {/* Live Clock Display (derived from timestamps) */}
            <View style={styles.clockContainer}>
              <Text style={styles.clockText}>{elapsedFormatted}</Text>
              <Text style={styles.clockSub}>elapsed</Text>
            </View>

            {/* Estimated time status */}
            {estimatedMins > 0 ? (
              <View style={styles.estimateRow}>
                <Ionicons name="time-outline" size={14} color={C.sub} />
                <Text style={styles.estimateText}>
                  {remainingMins > 0
                    ? `~${remainingMins} min remaining of ${estimatedMins}m est.`
                    : `Estimated duration reached (${estimatedMins}m)`}
                </Text>
              </View>
            ) : null}

            {/* State tag */}
            <View style={styles.stateChipContainer}>
              <Chip color={isRunning ? C.green : isPaused ? C.amber : C.sub}>
                <Ionicons
                  name={isRunning ? 'play' : isPaused ? 'pause' : 'ellipse'}
                  size={10}
                  color={isRunning ? C.green : isPaused ? C.amber : C.sub}
                />
                <Text
                  style={{
                    color: isRunning ? C.green : isPaused ? C.amber : C.sub,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {isRunning ? 'RUNNING' : isPaused ? 'PAUSED' : 'IDLE'}
                </Text>
              </Chip>
            </View>
          </Animated.View>

          {/* Actions */}
          <View style={styles.actionContainer}>
            <View style={styles.actionRow}>
              {isRunning ? (
                <Btn
                  variant="secondary"
                  size="large"
                  icon="pause-circle-outline"
                  onPress={handlePause}
                  style={styles.actionBtn}
                >
                  Pause
                </Btn>
              ) : (
                <Btn
                  variant="primary"
                  size="large"
                  icon="play-circle-outline"
                  onPress={handleResume}
                  style={styles.actionBtn}
                >
                  Resume
                </Btn>
              )}

              <Btn
                variant="primary"
                size="large"
                icon="checkmark-circle-outline"
                onPress={handleComplete}
                style={[styles.actionBtn, { backgroundColor: C.green }]}
              >
                Complete
              </Btn>
            </View>

            <View style={styles.secondaryRow}>
              <Pressable onPress={handleStop} hitSlop={10} style={styles.stopPressable}>
                <Ionicons name="stop-circle-outline" size={16} color={C.faint} />
                <Text style={styles.stopText}>Stop & Exit (Keep Task)</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 6, 12, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.m,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.surface,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: alpha(C.violet, 0.35),
    padding: S.l,
    paddingBottom: Platform.OS === 'ios' ? 28 : 22,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.m,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 4,
  },
  card: {
    backgroundColor: C.surface2,
    borderRadius: R.l,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.l,
    alignItems: 'center',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  projectName: {
    color: C.violet,
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  taskDesc: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: S.m,
  },
  clockContainer: {
    marginVertical: S.m,
    alignItems: 'center',
  },
  clockText: {
    color: C.text,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  clockSub: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -4,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  estimateText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '600',
  },
  stateChipContainer: {
    marginTop: 8,
  },
  actionContainer: {
    marginTop: S.l,
    gap: S.m,
  },
  actionRow: {
    flexDirection: 'row',
    gap: S.s,
  },
  actionBtn: {
    flex: 1,
  },
  secondaryRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  stopPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  stopText: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '600',
  },
});
