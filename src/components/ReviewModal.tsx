import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { fmtDateLong, fmtDur, localDateKey } from '../lib/dates';
import { getEveningReviewSnapshot } from '../lib/engine';
import { useStore } from '../lib/store';
import type { DailyMood } from '../types';
import { alpha, C, inr, R, S } from '../theme';
import { Btn, Card, Chip, Label } from './ui';

const MOODS: Array<{ key: DailyMood; icon: string; label: string; color: string }> = [
  { key: 'bad', icon: 'sad-outline', label: 'Rough', color: '#FB7185' },
  { key: 'neutral', icon: 'remove-circle-outline', label: 'Okay', color: '#FFB454' },
  { key: 'good', icon: 'happy-outline', label: 'Good', color: '#60A5FA' },
  { key: 'great', icon: 'sparkles', label: 'Great', color: '#34D399' },
];

export function ReviewModal({
  visible,
  onClose,
  dateKey,
}: {
  visible: boolean;
  onClose: () => void;
  dateKey?: string;
}) {
  const { state, saveDailyReview } = useStore();
  const targetDateKey = dateKey ?? localDateKey();

  const snapshot = useMemo(() => {
    if (!state) return null;
    return getEveningReviewSnapshot(state, targetDateKey);
  }, [state, targetDateKey, visible]);

  const [selectedMood, setSelectedMood] = useState<DailyMood | undefined>(undefined);
  const [reflection, setReflection] = useState('');

  useEffect(() => {
    if (visible && snapshot?.existingReview) {
      setSelectedMood(snapshot.existingReview.mood);
      setReflection(snapshot.existingReview.reflection || '');
    } else if (visible) {
      setSelectedMood(undefined);
      setReflection('');
    }
  }, [visible, snapshot]);

  if (!state || !snapshot) return null;

  const handleSave = () => {
    saveDailyReview({
      dateKey: targetDateKey,
      completedTasks: snapshot.completedTasksCount,
      completedHabits: snapshot.completedHabitsCount,
      focusMinutes: snapshot.focusMinutesToday,
      plannedMinutes: snapshot.plannedMinutes,
      spentAmount: snapshot.spentAmount,
      mood: selectedMood,
      reflection: reflection.trim() || undefined,
    });
    onClose();
  };

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
                <Ionicons name="moon" size={20} color={C.amber} />
              </View>
              <View>
                <Text style={styles.title}>Day Review</Text>
                <Text style={styles.subtitle}>{fmtDateLong()}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Completion Highlights */}
            <Card style={styles.statCard}>
              <View style={styles.metricsRow}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricVal}>{snapshot.completedTasksCount}</Text>
                  <Label>Tasks Done</Label>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricCol}>
                  <Text style={styles.metricVal}>{fmtDur(snapshot.focusMinutesToday)}</Text>
                  <Label>Focused</Label>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricCol}>
                  <Text style={styles.metricVal}>
                    {snapshot.completedHabitsCount}/{snapshot.totalHabitsCount}
                  </Text>
                  <Label>Habits</Label>
                </View>
              </View>
            </Card>

            {/* Time & Spending Row */}
            <View style={styles.summaryGrid}>
              <Card style={{ flex: 1, padding: S.m }}>
                <Label style={{ marginBottom: 4 }}>Time Balance</Label>
                <Text style={{ color: C.text, fontSize: 13 }}>
                  Planned: <Text style={{ fontWeight: '700' }}>{fmtDur(snapshot.plannedMinutes)}</Text>
                </Text>
                <Text style={{ color: C.green, fontSize: 13, marginTop: 2 }}>
                  Focused: <Text style={{ fontWeight: '700' }}>{fmtDur(snapshot.focusMinutesToday)}</Text>
                </Text>
              </Card>

              <Card style={{ flex: 1, padding: S.m }}>
                <Label style={{ marginBottom: 4 }}>Daily Spending</Label>
                <Text style={{ color: C.text, fontSize: 13 }}>
                  {inr(snapshot.spentAmount)} / {inr(snapshot.dailyBudget)}
                </Text>
                <Text
                  style={{
                    color: snapshot.spentAmount <= snapshot.dailyBudget ? C.green : C.pink,
                    fontSize: 12,
                    fontWeight: '600',
                    marginTop: 2,
                  }}
                >
                  {snapshot.spentAmount <= snapshot.dailyBudget
                    ? `${inr(snapshot.dailyBudget - snapshot.spentAmount)} surplus`
                    : `${inr(snapshot.spentAmount - snapshot.dailyBudget)} over budget`}
                </Text>
              </Card>
            </View>

            {/* Tomorrow Head Start */}
            <Card style={{ padding: S.m, borderColor: alpha(C.teal, 0.3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="sunny-outline" size={14} color={C.teal} />
                <Label style={{ color: C.teal }}>Looking Ahead To Tomorrow</Label>
              </View>
              <Text style={{ color: C.text, fontSize: 13, lineHeight: 18 }}>
                {snapshot.tomorrowPriorityTasksCount} priority tasks pending ·{' '}
                {snapshot.tomorrowDeadlinesCount} approaching deadlines
              </Text>
            </Card>

            {/* Mood Reflection */}
            <View style={styles.moodSection}>
              <Text style={styles.sectionTitle}>How was today?</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setSelectedMood(m.key === selectedMood ? undefined : m.key)}
                    style={[
                      styles.moodBtn,
                      selectedMood === m.key && {
                        borderColor: m.color,
                        backgroundColor: alpha(m.color, 0.18),
                      },
                    ]}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={24}
                      color={selectedMood === m.key ? m.color : C.sub}
                    />
                    <Text
                      style={[
                        styles.moodLabel,
                        { color: selectedMood === m.key ? m.color : C.faint },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Reflection Note */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>QUICK NOTE (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={reflection}
                onChangeText={setReflection}
                placeholder="What went well or what could improve tomorrow?"
                placeholderTextColor={C.faint}
                multiline
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Btn variant="primary" size="large" onPress={handleSave}>
                Save Review
              </Btn>
              <Pressable onPress={onClose} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </View>
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
    borderColor: alpha(C.amber, 0.35),
    padding: S.l,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    maxHeight: '90%',
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
    backgroundColor: alpha(C.amber, 0.16),
    borderWidth: 1,
    borderColor: alpha(C.amber, 0.4),
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
  scroll: {
    gap: S.m,
  },
  statCard: {
    backgroundColor: C.surface2,
    padding: S.m,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricCol: {
    alignItems: 'center',
    gap: 4,
  },
  metricVal: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: C.border,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: S.s,
  },
  moodSection: {
    marginTop: 4,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: R.m,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  moodLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.m,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  actions: {
    marginTop: S.m,
    gap: S.s,
  },
  skipBtn: {
    alignItems: 'center',
    padding: 8,
  },
  skipText: {
    color: C.faint,
    fontSize: 13,
    fontWeight: '600',
  },
});
