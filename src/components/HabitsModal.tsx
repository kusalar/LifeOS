import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { localDateKey, shiftDateKey } from '../lib/dates';
import { getHabitStreak } from '../lib/engine';
import { useStore, useUI } from '../lib/store';
import type { Habit } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn, Card, Chip, IconBadge, Label } from './ui';

export function HabitsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { state, toggleHabit } = useStore();
  const { openHabitSheet } = useUI();
  const [showInactive, setShowInactive] = useState(false);

  const habits = state?.habits ?? [];
  const completions = state?.habitCompletions ?? [];
  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);
  const inactiveHabits = useMemo(() => habits.filter((h) => !h.active), [habits]);

  const todayKey = localDateKey();
  const recentDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(shiftDateKey(todayKey, -i));
    }
    return days;
  }, [todayKey]);

  if (!state) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={styles.container}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="repeat" size={20} color={C.violet} />
              </View>
              <View>
                <Text style={styles.title}>Daily Habits</Text>
                <Text style={styles.subtitle}>
                  {activeHabits.length} active · Streak consistency tracking
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close habits modal"
            >
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <Btn
              variant="primary"
              size="small"
              icon="add-circle-outline"
              onPress={() => {
                openHabitSheet();
              }}
            >
              New Habit
            </Btn>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {activeHabits.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="sparkles-outline" size={32} color={C.faint} />
                <Text style={styles.emptyTitle}>No active habits yet</Text>
                <Text style={styles.emptyDesc}>
                  Create daily recurring habits like Study, Exercise, or Reading to build momentum.
                </Text>
              </Card>
            ) : (
              activeHabits.map((habit) => {
                const streak = getHabitStreak(habit.id, completions);
                const color = habit.color || C.violet;

                return (
                  <Card key={habit.id} style={styles.habitCard}>
                    <View style={styles.cardHeader}>
                      <Pressable
                        onPress={() => toggleHabit(habit.id)}
                        hitSlop={8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: streak.isCompletedToday }}
                        accessibilityLabel={`${habit.name}, ${streak.isCompletedToday ? 'completed' : 'not completed'}`}
                        style={[
                          styles.checkBtn,
                          streak.isCompletedToday && {
                            backgroundColor: color,
                            borderColor: color,
                          },
                        ]}
                      >
                        {streak.isCompletedToday && (
                          <Ionicons name="checkmark" size={16} color={C.bg} />
                        )}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.habitName,
                            streak.isCompletedToday && { textDecorationLine: 'line-through', color: C.sub },
                          ]}
                        >
                          {habit.name}
                        </Text>
                        {habit.description ? (
                          <Text style={styles.habitDesc} numberOfLines={1}>
                            {habit.description}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={() => openHabitSheet(habit)}
                        hitSlop={8}
                        style={styles.editBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit habit ${habit.name}`}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={C.sub} />
                      </Pressable>
                    </View>

                    {/* Streak & History Row */}
                    <View style={styles.cardFooter}>
                      <View style={styles.streakBadge}>
                        <Ionicons name="flame" size={13} color={C.amber} />
                        <Text style={styles.streakText}>
                          {streak.currentStreak} day{streak.currentStreak === 1 ? '' : 's'}{' '}
                          <Text style={{ color: C.faint }}>· Best {streak.longestStreak}</Text>
                        </Text>
                      </View>

                      {/* 7-day dot tracker */}
                      <View style={styles.dotsRow}>
                        {recentDays.map((dKey, idx) => {
                          const isDone = completions.some(
                            (c) => c.habitId === habit.id && c.dateKey === dKey
                          );
                          const isToday = dKey === todayKey;

                          return (
                            <View
                              key={dKey}
                              style={[
                                styles.dayDot,
                                isDone
                                  ? { backgroundColor: color }
                                  : { backgroundColor: C.surface3 },
                                isToday && { borderWidth: 1, borderColor: C.text },
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  </Card>
                );
              })
            )}

            {/* Inactive Habits Collapsible */}
            {inactiveHabits.length > 0 && (
              <View style={styles.inactiveSection}>
                <Pressable
                  onPress={() => setShowInactive(!showInactive)}
                  style={styles.inactiveToggle}
                >
                  <Text style={styles.inactiveToggleText}>
                    {showInactive ? 'Hide' : 'Show'} Inactive Habits ({inactiveHabits.length})
                  </Text>
                  <Ionicons
                    name={showInactive ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={C.faint}
                  />
                </Pressable>

                {showInactive && (
                  <View style={{ gap: S.s, marginTop: S.s }}>
                    {inactiveHabits.map((h) => (
                      <Card key={h.id} style={[styles.habitCard, { opacity: 0.6 }]}>
                        <View style={styles.cardHeader}>
                          <Text style={[styles.habitName, { color: C.faint }]}>{h.name}</Text>
                          <Btn
                            variant="secondary"
                            size="small"
                            onPress={() => openHabitSheet(h)}
                          >
                            Manage
                          </Btn>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,6,12,0.85)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xxl,
    borderTopRightRadius: R.xxl,
    borderWidth: 1,
    borderColor: alpha(C.violet, 0.35),
    padding: S.l,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    maxHeight: '88%',
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surface3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.m,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: alpha(C.violet, 0.16),
    borderWidth: 1,
    borderColor: alpha(C.violet, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: C.text,
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    color: C.faint,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: S.m,
  },
  scroll: {
    gap: S.m,
  },
  emptyCard: {
    alignItems: 'center',
    padding: S.xl,
    gap: 8,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  habitCard: {
    padding: S.m,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  habitDesc: {
    color: C.sub,
    fontSize: 12,
    marginTop: 1,
  },
  editBtn: {
    padding: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inactiveSection: {
    marginTop: S.m,
  },
  inactiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  inactiveToggleText: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '600',
  },
});
