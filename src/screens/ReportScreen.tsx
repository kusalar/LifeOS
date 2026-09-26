import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Card, Chip, IconBadge, Label, SectionHeader } from '../components/ui';
import { fmtDateLong, fmtDur } from '../lib/dates';
import { reportStats } from '../lib/engine';
import { useStore } from '../lib/store';
import { alpha, C, inr, R, S } from '../theme';

export function ReportScreen() {
  const { state } = useStore();
  const stats = useMemo(() => (state ? reportStats(state) : null), [state]);

  if (!state || !stats) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const tiles = [
    { icon: 'checkbox-outline', color: C.green, label: 'Tasks Done', value: `${stats.tasksDone}/${stats.tasksTotal}` },
    { icon: 'wallet-outline', color: C.amber, label: 'Money Spent', value: inr(stats.spent) },
    { icon: 'book-outline', color: C.violet, label: 'Focus & Study', value: fmtDur(stats.studyMin) },
    { icon: 'calendar-outline', color: C.teal, label: 'Blocks Done', value: `${stats.blocksDone}/${stats.blocksTotal}` },
    { icon: 'barbell-outline', color: C.pink, label: 'Exercise', value: `${stats.exerciseMin}m` },
    { icon: 'phone-portrait-outline', color: C.blue, label: 'Screen Time', value: stats.screen },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>Daily Report</Text>
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{fmtDateLong()}</Text>
          </View>
          <Chip color={C.amber}>
            <Ionicons name="flame" size={13} color={C.amber} />
            <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>{state.reportStreak}-night streak</Text>
          </Chip>
        </Animated.View>

        {/* 1. DAILY SUMMARY & PRODUCTIVITY HERO */}
        <Animated.View entering={FadeInDown.delay(70).springify()}>
          <Card style={{ marginTop: S.l, borderColor: alpha(C.amber, 0.35), padding: S.l }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.l }}>
              <View>
                <Text style={{ color: C.amber, fontSize: 44, fontWeight: '800' }}>{stats.productivity}%</Text>
                <Label style={{ marginTop: 2 }}>Productivity</Label>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Bar pct={stats.productivity} color={C.amber} height={10} />
                <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 20, fontWeight: '600' }}>
                  {stats.daySummary}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* 2. TASK & SPENDING STATUS GRID (2 columns with clean breathing room) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: S.m, marginTop: S.m }}>
          {tiles.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.delay(120 + i * 40).springify()} style={{ width: '48.5%' }}>
              <Card style={{ padding: S.m + 2, minHeight: 84, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconBadge icon={t.icon as any} color={t.color} size={28} iconSize={14} />
                  <Text
                    style={{
                      color: C.sub,
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {t.label}
                  </Text>
                </View>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>{t.value}</Text>
              </Card>
            </Animated.View>
          ))}
        </View>

        {/* 2.5 FOCUS & HABITS REPORT SECTIONS */}
        <SectionHeader title="Deep Focus" icon="flash-outline" right="This Week" />
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <Card style={{ padding: S.l }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: S.s }}>
              <View style={{ flex: 1 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Total Focus</Label>
                <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '800', marginTop: 4 }}>
                  {stats.focusTotalThisWeek > 0 ? fmtDur(stats.focusTotalThisWeek) : '0m'}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: C.border }} />
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Avg Session</Label>
                <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '800', marginTop: 4 }}>
                  {stats.focusAvgSession !== null ? fmtDur(stats.focusAvgSession) : '—'}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: C.border }} />
              <View style={{ flex: 1.2, paddingLeft: 8 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Top Project</Label>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>
                  {stats.topFocusedProjectName ?? '—'}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* HABITS & TASKS BREAKDOWN */}
        <View style={{ flexDirection: 'row', gap: S.m, marginTop: S.m }}>
          {/* Habits Breakdown */}
          <View style={{ flex: 1 }}>
            <Card style={{ flex: 1, padding: S.m + 2, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="repeat-outline" size={15} color={C.amber} />
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>Habits</Text>
              </View>
              <View>
                <Label style={{ fontSize: 10.5 }}>Completion Rate</Label>
                <Text style={{ color: C.text, fontSize: 19, fontWeight: '800', marginTop: 2 }}>
                  {stats.habitsCompletionRate !== null ? `${stats.habitsCompletionRate}%` : '—'}
                </Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.sub, fontSize: 12 }}>Current Streak</Text>
                  <Text style={{ color: C.amber, fontSize: 12.5, fontWeight: '700' }}>
                    {stats.habitsCurrentStreak}d
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.sub, fontSize: 12 }}>Best Streak</Text>
                  <Text style={{ color: C.teal, fontSize: 12.5, fontWeight: '700' }}>
                    {stats.habitsBestStreak}d
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* Tasks Breakdown */}
          <View style={{ flex: 1 }}>
            <Card style={{ flex: 1, padding: S.m + 2, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkbox-outline" size={15} color={C.green} />
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>Tasks</Text>
              </View>
              <View>
                <Label style={{ fontSize: 10.5 }}>Completion Rate</Label>
                <Text style={{ color: C.green, fontSize: 19, fontWeight: '800', marginTop: 2 }}>
                  {stats.tasksCompletionRate}%
                </Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.sub, fontSize: 12 }}>Completed</Text>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700' }}>
                    {stats.tasksDone}/{stats.tasksTotal}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.sub, fontSize: 12 }}>Overdue</Text>
                  <Text style={{ color: stats.tasksOverdue > 0 ? C.pink : C.text, fontSize: 12.5, fontWeight: '700' }}>
                    {stats.tasksOverdue}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </View>

        {/* TIME BREAKDOWN */}
        <SectionHeader title="Time Balance" icon="time-outline" right="Today" />
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Card style={{ paddingVertical: S.l, paddingHorizontal: S.m }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Planned</Label>
                <Text style={{ color: C.blue, fontSize: 17, fontWeight: '800', marginTop: 4 }}>
                  {fmtDur(stats.timePlannedMinutes)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: C.border }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Focused</Label>
                <Text style={{ color: C.green, fontSize: 17, fontWeight: '800', marginTop: 4 }}>
                  {fmtDur(stats.timeFocusedMinutes)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: C.border }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Label style={{ fontSize: 11, letterSpacing: 0.8 }}>Available</Label>
                <Text style={{ color: C.teal, fontSize: 17, fontWeight: '800', marginTop: 4 }}>
                  {fmtDur(stats.timeAvailableMinutes)}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* 3. IMPORTANT REMINDERS STATUS */}
        {stats.importantReminders.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(240).springify()}>
            <Card style={{ marginTop: S.m, borderColor: alpha(C.teal, 0.3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="notifications-outline" size={15} color={C.teal} />
                <Label style={{ color: C.teal }}>Important Reminders</Label>
              </View>
              {stats.importantReminders.map((rem, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 6,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: C.border,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={C.teal} />
                  <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{rem}</Text>
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {/* 4. PERSONAL INSIGHTS & PATTERNS */}
        <SectionHeader title="Your Patterns" icon="sparkles-outline" right="Personal Insights" />
        <Animated.View entering={FadeInDown.delay(280).springify()}>
          <Card style={{ backgroundColor: alpha(C.violet, 0.08), borderColor: alpha(C.violet, 0.3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
              <Ionicons name="sparkles" size={15} color={C.violet} />
              <Label style={{ color: C.violet }}>Deterministic Pattern Detection</Label>
            </View>
            {stats.personalInsights.length === 0 ? (
              <Text style={{ color: C.sub, fontSize: 13 }}>
                Not enough data yet. Complete more focus sessions, habits, and tasks to reveal your productivity patterns.
              </Text>
            ) : (
              stats.personalInsights.map((ins, i) => (
                <View
                  key={ins.id}
                  style={{
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: C.border,
                    gap: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.violet, fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {ins.category} · {ins.title}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>{ins.timePeriod}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', lineHeight: 19 }}>
                    {ins.observation}
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 12, lineHeight: 16 }}>
                    {ins.factualBasis}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </Animated.View>

        {/* 5. TOMORROW'S PRIORITY (Ranked top 3) */}
        <SectionHeader title="Tomorrow's Priority" icon="sunny-outline" right="Top 3 to tackle" />
        <Animated.View entering={FadeInDown.delay(320).springify()}>
          <Card>
            {stats.tomorrow.map((t, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: S.m,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: alpha(C.amber, 0.16),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: C.amber, fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <IconBadge icon={t.icon as any} color={C.amber} size={34} iconSize={16} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t.text}</Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{t.sub}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: S.xl, lineHeight: 18 }}>
          LifeOS stays private on your device. Every day brings you closer to your goals. 🔒
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
