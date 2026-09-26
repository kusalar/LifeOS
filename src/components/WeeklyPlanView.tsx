import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { fmtDur } from '../lib/dates';
import { getWeeklyPlanningSummary } from '../lib/engine';
import { useStore } from '../lib/store';
import { alpha, C, R, S } from '../theme';
import { Btn, Card, Chip, IconBadge, Label, SectionHeader } from './ui';

export function WeeklyPlanView({ onPlanWork }: { onPlanWork?: () => void }) {
  const { state, confirmWeeklyPlan } = useStore();

  const summary = useMemo(
    () => (state ? getWeeklyPlanningSummary(state) : null),
    [state]
  );

  if (!state || !summary) return null;

  const { lastWeek, thisWeek, weeklyPlan } = summary;

  return (
    <View style={{ gap: S.m }}>
      {/* 1. LAST WEEK: Historical Execution */}
      <SectionHeader title="Last Week's Execution" icon="time-outline" right="Actual History" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        <View style={{ width: '48.5%' }}>
          <Card style={{ padding: 12, backgroundColor: C.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconBadge icon="checkbox-outline" color={C.green} size={24} iconSize={12} />
              <Label style={{ fontSize: 11 }}>Tasks Done</Label>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 6 }}>
              {lastWeek.tasksCompleted}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>Completed</Text>
          </Card>
        </View>

        <View style={{ width: '48.5%' }}>
          <Card style={{ padding: 12, backgroundColor: C.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconBadge icon="flash-outline" color={C.amber} size={24} iconSize={12} />
              <Label style={{ fontSize: 11 }}>Focus Time</Label>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 6 }}>
              {fmtDur(lastWeek.focusMinutes)}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>Deep focus logged</Text>
          </Card>
        </View>

        <View style={{ width: '48.5%' }}>
          <Card style={{ padding: 12, backgroundColor: C.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconBadge icon="refresh-outline" color={C.violet} size={24} iconSize={12} />
              <Label style={{ fontSize: 11 }}>Habits</Label>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 6 }}>
              {lastWeek.habitConsistencyPct}%
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>Consistency rate</Text>
          </Card>
        </View>

        <View style={{ width: '48.5%' }}>
          <Card style={{ padding: 12, backgroundColor: C.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconBadge icon="briefcase-outline" color={C.blue} size={24} iconSize={12} />
              <Label style={{ fontSize: 11 }}>Projects</Label>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 6 }}>
              {lastWeek.projectsProgressed}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>Progressed</Text>
          </Card>
        </View>
      </View>

      {/* Planned vs Actual */}
      <Card style={{ padding: S.m, backgroundColor: C.surface2, borderColor: C.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>PLANNED FOCUS</Text>
            <Text style={{ color: C.sub, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
              {fmtDur(lastWeek.plannedMinutes || 360)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={C.faint} />
          <View>
            <Text style={{ color: C.amber, fontSize: 11, fontWeight: '800' }}>ACTUAL FOCUS</Text>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
              {fmtDur(lastWeek.actualMinutes || lastWeek.focusMinutes)}
            </Text>
          </View>
        </View>
      </Card>

      {/* 2. THIS WEEK: Commitments & Demands */}
      <SectionHeader title="This Week's Demands" icon="calendar-outline" right="Upcoming" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 95, backgroundColor: C.surface2, borderRadius: R.l, padding: 10, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.red, fontSize: 16, fontWeight: '800' }}>
            {thisWeek.upcomingDeadlinesCount}
          </Text>
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>Deadlines</Text>
        </View>

        <View style={{ flex: 1, minWidth: 95, backgroundColor: C.surface2, borderRadius: R.l, padding: 10, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.amber, fontSize: 16, fontWeight: '800' }}>
            {thisWeek.highPriorityTasksCount}
          </Text>
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>Priority tasks</Text>
        </View>

        <View style={{ flex: 1, minWidth: 95, backgroundColor: C.surface2, borderRadius: R.l, padding: 10, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.blue, fontSize: 16, fontWeight: '800' }}>
            {thisWeek.activeProjectsCount}
          </Text>
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>Active projects</Text>
        </View>
      </View>

      {/* 3. WEEKLY CAPACITY & WORKLOAD PLAN */}
      <SectionHeader title="Realistic Weekly Capacity" icon="speedometer-outline" right="Calculated" />

      <Card style={{ padding: S.l, borderColor: alpha(C.teal, 0.35), backgroundColor: alpha(C.teal, 0.05) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <IconBadge icon="analytics-outline" color={C.teal} size={28} iconSize={16} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>
              Transparent Capacity Model
            </Text>
            <Text style={{ color: C.faint, fontSize: 11 }}>
              Based on working hours minus commitments & realistic buffer
            </Text>
          </View>
        </View>

        <View style={{ gap: 8, marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.sub, fontSize: 13 }}>Total working window (7 days)</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{weeklyPlan.totalUsableHours}h</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.sub, fontSize: 13 }}>Scheduled commitments</Text>
            <Text style={{ color: C.blue, fontSize: 13, fontWeight: '700' }}>-{weeklyPlan.committedHours}h</Text>
          </View>

          <View style={{ height: 1, backgroundColor: C.border2, marginVertical: 2 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>Available usable time</Text>
            <Text style={{ color: C.teal, fontSize: 14, fontWeight: '800' }}>
              {Math.max(0, Math.round((weeklyPlan.totalUsableHours - weeklyPlan.committedHours) * 10) / 10)}h
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.amber, fontSize: 14, fontWeight: '800' }}>Recommended task workload</Text>
            <Text style={{ color: C.amber, fontSize: 16, fontWeight: '800' }}>
              ~{weeklyPlan.suggestedTaskCapacityHours}h
            </Text>
          </View>
        </View>

        <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>
          LifeOS avoids assuming every theoretically free minute is productive. Workload targets ~70% of available time to prevent burnout and absorb delays.
        </Text>

        <View style={{ marginTop: S.m, paddingTop: S.m, borderTopWidth: 1, borderTopColor: C.border2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {weeklyPlan.planConfirmed ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>Weekly Plan Confirmed</Text>
              </>
            ) : (
              <>
                <Ionicons name="ellipse-outline" size={14} color={C.faint} />
                <Text style={{ color: C.faint, fontSize: 12, fontWeight: '600' }}>Plan pending confirmation</Text>
              </>
            )}
          </View>

          <Btn
            variant={weeklyPlan.planConfirmed ? 'secondary' : 'primary'}
            compact
            icon="checkmark"
            onPress={() => confirmWeeklyPlan()}
          >
            {weeklyPlan.planConfirmed ? 'Confirmed' : 'Confirm Plan'}
          </Btn>
        </View>
      </Card>
    </View>
  );
}
