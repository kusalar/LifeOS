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
      <ScrollView contentContainerStyle={{ padding: S.l, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
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
          <Card style={{ marginTop: S.l, borderColor: alpha(C.amber, 0.35) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.l }}>
              <View>
                <Text style={{ color: C.amber, fontSize: 44, fontWeight: '800' }}>{stats.productivity}%</Text>
                <Label style={{ marginTop: 2 }}>Productivity</Label>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Bar pct={stats.productivity} color={C.amber} height={10} />
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
                  {stats.daySummary}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* 2. TASK & SPENDING STATUS GRID */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.s, marginTop: S.m }}>
          {tiles.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.delay(120 + i * 40).springify()} style={{ width: '48%', flex: 1 }}>
              <Card style={{ flex: 1, padding: S.m + 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconBadge icon={t.icon as any} color={t.color} size={30} iconSize={15} />
                  <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {t.label}
                  </Text>
                </View>
                <Text style={{ color: C.text, fontSize: 19, fontWeight: '800', marginTop: 8 }}>{t.value}</Text>
              </Card>
            </Animated.View>
          ))}
        </View>

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

        {/* 4. KEY INSIGHTS */}
        <Animated.View entering={FadeInDown.delay(280).springify()}>
          <Card style={{ marginTop: S.m, backgroundColor: alpha(C.violet, 0.08), borderColor: alpha(C.violet, 0.3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
              <Ionicons name="sparkles" size={15} color={C.violet} />
              <Label style={{ color: C.violet }}>LifeOS Key Insights</Label>
            </View>
            {stats.insights.map((ins, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}
              >
                <Ionicons name={ins.icon as any} size={15} color={C.sub} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, color: C.text, fontSize: 13, lineHeight: 19 }}>{ins.text}</Text>
              </View>
            ))}
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
