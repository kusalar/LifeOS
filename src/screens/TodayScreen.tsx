import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bar,
  Btn,
  Card,
  CheckCircle,
  Chip,
  IconBadge,
  Label,
  PriorityBadge,
  SectionHeader,
} from '../components/ui';
import {
  daysUntil,
  dueLabel,
  fmtDateLong,
  fmtDur,
  fmtTime,
  greeting,
  isOverdueDay,
  nowMinutes,
  useNow,
} from '../lib/dates';
import {
  calculateDayStatus,
  getCurrentScheduleContext,
  getEveningReviewSnapshot,
  getLifeOSRadar,
  getMorningBrief,
  getProjectDeadlinePressure,
  getProjectsNeedingAttention,
  getProjectStats,
  getTodayHabitsSummary,
  getUsableTimeToday,
  getWhatToDoNow,
  moneyInsights,
  nowBlock,
  TYPE_META,
} from '../lib/engine';
import { useStore, useUI } from '../lib/store';
import { alpha, C, inr, R, S, shadow } from '../theme';

export function TodayScreen({ navigation }: { navigation: any }) {
  const {
    state,
    rememberReminder,
    dismissReminder,
    completeReminder,
    toggleTask,
    toggleBlock,
    startTask,
    pauseTask,
    resumeTask,
    stopActiveTask,
    completeActiveTask,
    toggleHabit,
  } = useStore();
  const {
    openAsk,
    openExpense,
    openNowModal,
    openTask,
    openReminder,
    openProject,
    openFocusModal,
    openHabitSheet,
    openReviewModal,
    openHabitsModal,
    openRescheduleModal,
  } = useUI();
  const now = useNow(30000);
  const [briefDismissed, setBriefDismissed] = useState(false);

  const schedule = state?.schedule ?? [];
  const tasks = state?.tasks ?? [];
  const projects = state?.projects ?? [];
  const { current, next } = nowBlock(schedule, now);

  const usable = useMemo(
    () => getUsableTimeToday(schedule, now, state?.workDayStart, state?.workDayEnd),
    [schedule, now, state?.workDayStart, state?.workDayEnd]
  );

  const money = useMemo(
    () => (state ? moneyInsights(state.expenses, state.weeklyBudget, state.dailyBudget, state.monthlyBudget) : null),
    [state]
  );

  const radar = useMemo(() => (state ? getLifeOSRadar(state) : []), [state]);
  const whatNow = useMemo(() => (state ? getWhatToDoNow(state) : null), [state]);
  const attentionProjects = useMemo(() => getProjectsNeedingAttention(projects, tasks), [projects, tasks]);
  const morningBrief = useMemo(() => (state ? getMorningBrief(state) : null), [state]);
  const habitsSummary = useMemo(
    () => (state ? getTodayHabitsSummary(state.habits ?? [], state.habitCompletions ?? []) : null),
    [state]
  );
  const eveningSnapshot = useMemo(() => (state ? getEveningReviewSnapshot(state) : null), [state]);
  const { dayStatus, proposals } = useMemo(
    () => (state ? calculateDayStatus(state, now) : { dayStatus: null, proposals: [] }),
    [state, now]
  );
  const scheduleContext = useMemo(
    () => (state ? getCurrentScheduleContext(state.schedule ?? [], now) : null),
    [state?.schedule, now]
  );

  if (!state || !money) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const progress = current ? Math.round(((nowMinutes(now) - current.start) / (current.end - current.start)) * 100) : 0;

  // Active focused task if user started one
  const activeTask = state.activeTaskId
    ? tasks.find((t) => t.id === state.activeTaskId && !t.done)
    : null;

  // Derive active focus elapsed time
  const isRunning = Boolean(state.activeTaskStartedAt);
  const isPaused = Boolean(state.activeTaskPausedAt);
  const accumulatedMs = state.activeTaskAccumulatedMs ?? 0;
  const runningElapsedMs = isRunning && state.activeTaskStartedAt ? Math.max(0, now.getTime() - state.activeTaskStartedAt) : 0;
  const activeElapsedMins = Math.floor((accumulatedMs + runningElapsedMs) / 60000);

  // Snapshot calculations
  const priorityTasksCount = tasks.filter((t) => !t.done && (t.priority === 'critical' || t.priority === 'important')).length;
  const upcomingDeadlinesCount =
    tasks.filter((t) => !t.done && !isOverdueDay(t.dueTs) && daysUntil(t.dueTs) <= 2).length +
    projects.filter((p) => p.status === 'active' && p.deadline && daysUntil(p.deadline) <= 3).length;

  const attentionTasks = tasks
    .filter((t) => !t.done && (t.priority === 'critical' || t.priority === 'important'))
    .slice(0, 3);

  const newDetections = (state.reminders ?? []).filter((r) => r.status === 'new');
  const trackedReminders = (state.reminders ?? [])
    .filter((r) => r.status === 'tracked')
    .sort((a, b) => a.dueTs - b.dueTs)
    .slice(0, 4);

  const isEvening = now.getHours() >= 18;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. TODAY HEADER & MORNING BRIEF */}
        <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.amber, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {greeting(now)}
            </Text>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', marginTop: 2 }}>
              {fmtDateLong(now)}
            </Text>
            <Text style={{ color: C.sub, fontSize: 13.5, fontWeight: '600', marginTop: 4 }}>
              {usable.remainingUsableMinutes > 0
                ? `You have ${usable.formattedRemaining} of usable time today.`
                : 'Your daily focus window is wrapping up. Rest and recharge.'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={openAsk}
              hitSlop={8}
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: alpha(C.violet, 0.16),
                borderWidth: 1,
                borderColor: alpha(C.violet, 0.35),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={20} color={C.violet} />
            </Pressable>
          </View>
        </Animated.View>

        {/* PHASE 4: MORNING DAILY BRIEF */}
        {morningBrief && !briefDismissed && (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <Card
              style={{
                marginTop: S.m,
                backgroundColor: alpha(C.amber, 0.08),
                borderColor: alpha(C.amber, 0.35),
                padding: S.m,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sunny" size={15} color={C.amber} />
                  <Label style={{ color: C.amber, fontWeight: '800' }}>{greeting(now).toUpperCase()}</Label>
                </View>
                <Pressable onPress={() => setBriefDismissed(true)} hitSlop={10}>
                  <Ionicons name="close" size={16} color={C.faint} />
                </Pressable>
              </View>

              <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>
                Today you have{' '}
                <Text style={{ fontWeight: '700', color: C.amber }}>{morningBrief.priorityTasksCount} priority tasks</Text>,{' '}
                <Text style={{ fontWeight: '700', color: C.blue }}>{morningBrief.scheduledBlocksCount} scheduled blocks</Text>, and{' '}
                <Text style={{ fontWeight: '700', color: C.pink }}>{morningBrief.habitsRemainingCount} habits</Text> remaining.
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: alpha(C.amber, 0.2),
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>MAIN FOCUS</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {morningBrief.mainFocusTitle}
                  </Text>
                </View>
                <Btn
                  variant="primary"
                  compact
                  icon="play"
                  onPress={() => {
                    if (whatNow?.taskId) {
                      openFocusModal(whatNow.taskId);
                    } else {
                      openNowModal();
                    }
                  }}
                >
                  Start My Day
                </Btn>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* 2. DAILY SNAPSHOT */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={{ marginTop: S.m }}>
          <Card style={{ backgroundColor: C.surface, borderColor: C.border2, padding: S.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.m }}>
              <Ionicons name="speedometer-outline" size={14} color={C.amber} />
              <Label style={{ color: C.amber }}>Daily Snapshot</Label>
              <View style={{ flex: 1 }} />
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700' }}>
                {state.reportStreak}-day streak 🔥
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {/* Priority Tasks */}
              <View
                style={{
                  flex: 1,
                  minWidth: 95,
                  backgroundColor: C.surface2,
                  borderRadius: R.l,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text style={{ color: priorityTasksCount > 0 ? C.amber : C.green, fontSize: 17, fontWeight: '800' }}>
                  {priorityTasksCount}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Priority tasks
                </Text>
              </View>

              {/* Scheduled Time */}
              <View
                style={{
                  flex: 1,
                  minWidth: 95,
                  backgroundColor: C.surface2,
                  borderRadius: R.l,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text style={{ color: C.blue, fontSize: 17, fontWeight: '800' }}>
                  {usable.formattedScheduled}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Scheduled
                </Text>
              </View>

              {/* Usable Time Remaining */}
              <View
                style={{
                  flex: 1,
                  minWidth: 95,
                  backgroundColor: C.surface2,
                  borderRadius: R.l,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text style={{ color: C.teal, fontSize: 17, fontWeight: '800' }}>
                  {usable.formattedRemaining}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Available
                </Text>
              </View>

              {/* Deadlines Approaching */}
              <View
                style={{
                  flex: 1,
                  minWidth: 95,
                  backgroundColor: C.surface2,
                  borderRadius: R.l,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text style={{ color: upcomingDeadlinesCount > 0 ? C.red : C.sub, fontSize: 17, fontWeight: '800' }}>
                  {upcomingDeadlinesCount}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Deadlines
                </Text>
              </View>

              {/* Spending vs Budget */}
              <View
                style={{
                  flex: 1,
                  minWidth: 120,
                  backgroundColor: C.surface2,
                  borderRadius: R.l,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text
                  style={{
                    color: money.remainingDaily >= 0 ? C.green : C.red,
                    fontSize: 15,
                    fontWeight: '800',
                  }}
                  numberOfLines={1}
                >
                  {inr(money.todayTotal)} / {inr(money.dailyBudget)}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Today's spent
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* 3. YOUR NEXT MOVE / ACTIVE FOCUS */}
        {activeTask ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Card
              style={{
                marginTop: S.m,
                borderRadius: R.xl,
                backgroundColor: alpha(C.green, 0.08),
                borderWidth: 1.5,
                borderColor: alpha(C.green, 0.45),
                padding: S.l,
                ...shadow,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: isRunning ? C.green : C.amber,
                  }}
                />
                <Label style={{ color: isRunning ? C.green : C.amber, fontWeight: '800', letterSpacing: 1.2 }}>
                  {isRunning ? 'FOCUS SESSION ACTIVE' : 'FOCUS SESSION PAUSED'}
                </Label>
                <View style={{ flex: 1 }} />
                <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>
                  {activeElapsedMins}m elapsed
                </Text>
              </View>

              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginVertical: 2 }}>
                {activeTask.title}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <PriorityBadge priority={activeTask.priority} />
                {activeTask.projectId ? (
                  <Chip color={C.blue}>
                    <Ionicons name="folder-outline" size={12} color={C.blue} />
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '700' }}>
                      {projects.find((p) => p.id === activeTask.projectId)?.name || 'Project'}
                    </Text>
                  </Chip>
                ) : null}
                {activeTask.estimatedMinutes ? (
                  <Text style={{ color: C.sub, fontSize: 12 }}>
                    Est. {activeTask.estimatedMinutes}m (~{Math.max(0, activeTask.estimatedMinutes - activeElapsedMins)}m left)
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: S.l }}>
                <Btn
                  variant="primary"
                  icon="expand-outline"
                  onPress={() => openFocusModal(activeTask.id)}
                  style={{ flex: 2, backgroundColor: C.violet }}
                >
                  Open Focus
                </Btn>
                {isRunning ? (
                  <Btn
                    variant="secondary"
                    icon="pause"
                    onPress={pauseTask}
                    style={{ flex: 1 }}
                  >
                    Pause
                  </Btn>
                ) : (
                  <Btn
                    variant="secondary"
                    icon="play"
                    onPress={resumeTask}
                    style={{ flex: 1 }}
                  >
                    Resume
                  </Btn>
                )}
                <Btn
                  variant="primary"
                  icon="checkmark"
                  onPress={completeActiveTask}
                  style={{ flex: 1.2, backgroundColor: C.green }}
                >
                  Done
                </Btn>
              </View>
            </Card>
          </Animated.View>
        ) : whatNow ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Card
              style={{
                marginTop: S.m,
                borderRadius: R.xl,
                backgroundColor: alpha(C.violet, 0.12),
                borderWidth: 1.5,
                borderColor: alpha(C.violet, 0.45),
                padding: S.l,
                ...shadow,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: alpha(C.violet, 0.25),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="sparkles" size={13} color={C.violet} />
                </View>
                <Label style={{ color: C.violet, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
                  YOUR NEXT MOVE
                </Label>
                <View style={{ flex: 1 }} />
                <Pressable onPress={openNowModal} hitSlop={8}>
                  <Text style={{ color: C.violet, fontSize: 12, fontWeight: '700' }}>Why? →</Text>
                </Pressable>
              </View>

              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
                {whatNow.actionTitle}
              </Text>

              {/* Badges / Context row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <View
                  style={{
                    borderRadius: R.pill,
                    backgroundColor: alpha(whatNow.tagColor, 0.16),
                    borderWidth: 1,
                    borderColor: alpha(whatNow.tagColor, 0.4),
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: whatNow.tagColor, fontSize: 11, fontWeight: '800' }}>
                    {whatNow.category}
                  </Text>
                </View>

                {whatNow.projectName ? (
                  <Chip color={C.blue}>
                    <Ionicons name="folder-outline" size={11} color={C.blue} />
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '700' }}>
                      {whatNow.projectName}
                    </Text>
                  </Chip>
                ) : null}

                {whatNow.durationMins ? (
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '600' }}>
                    ~{whatNow.durationMins} min
                  </Text>
                ) : null}
              </View>

              <Text style={{ color: C.sub, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
                {whatNow.reason}
              </Text>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: S.m }}>
                {whatNow.taskId ? (
                  state.activeTaskId === whatNow.taskId ? (
                    <>
                      <Btn
                        variant="primary"
                        icon="checkmark-done"
                        onPress={completeActiveTask}
                        style={{ flex: 2, backgroundColor: C.green }}
                      >
                        DONE ({activeElapsedMins}m)
                      </Btn>
                      <Btn
                        variant="secondary"
                        icon={isPaused ? 'play-outline' : 'pause-outline'}
                        onPress={isPaused ? resumeTask : pauseTask}
                        style={{ flex: 1 }}
                      >
                        {isPaused ? 'Resume' : 'Pause'}
                      </Btn>
                    </>
                  ) : (
                    <>
                      <Btn
                        variant="primary"
                        icon="flash-outline"
                        onPress={() => startTask(whatNow.taskId!)}
                        style={{ flex: 2, backgroundColor: C.violet }}
                      >
                        START FOCUS
                      </Btn>
                      <Btn
                        variant="secondary"
                        icon="checkmark"
                        onPress={() => toggleTask(whatNow.taskId!)}
                        style={{ flex: 1 }}
                      >
                        Done
                      </Btn>
                    </>
                  )
                ) : whatNow.blockId ? (
                  <Btn
                    variant="primary"
                    icon="checkmark"
                    onPress={() => toggleBlock(whatNow.blockId!)}
                    style={{ flex: 1 }}
                  >
                    Mark Block Done
                  </Btn>
                ) : (
                  <Btn
                    variant="secondary"
                    icon="sparkles"
                    onPress={openNowModal}
                    style={{ flex: 1 }}
                  >
                    View Action
                  </Btn>
                )}
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* 3B. TODAY EXECUTION TIMELINE */}
        {scheduleContext &&
        (scheduleContext.currentBlock ||
          scheduleContext.nextBlock ||
          scheduleContext.pastBlocks.length > 0 ||
          scheduleContext.upcomingBlocks.length > 0) ? (
          <Animated.View entering={FadeInDown.delay(110).springify()} style={{ marginTop: S.m }}>
            <Card style={{ padding: S.m }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={16} color={C.teal} />
                  <Label style={{ color: C.teal, fontWeight: '800', letterSpacing: 0.8 }}>
                    EXECUTION TIMELINE
                  </Label>
                </View>
                <Chip color={scheduleContext.status === 'in_block' ? C.green : C.teal}>
                  <Text style={{ color: scheduleContext.status === 'in_block' ? C.green : C.teal, fontSize: 11, fontWeight: '700' }}>
                    {scheduleContext.status === 'in_block' ? 'In Progress' : `${scheduleContext.availableMinutes}m free window`}
                  </Text>
                </Chip>
              </View>

              {/* Current Block if present */}
              {scheduleContext.currentBlock ? (
                <View
                  style={{
                    backgroundColor: alpha(C.green, 0.1),
                    borderWidth: 1,
                    borderColor: alpha(C.green, 0.35),
                    borderRadius: R.m,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '800' }}>CURRENT</Text>
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>
                      {fmtTime(scheduleContext.currentBlock.start)} – {fmtTime(scheduleContext.currentBlock.end)}
                    </Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 3 }}>
                    {scheduleContext.currentBlock.title}
                  </Text>
                  {scheduleContext.currentBlock.source === 'external' ? (
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                      External commitment (read-only)
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Next Block if present */}
              {scheduleContext.nextBlock ? (
                <View
                  style={{
                    backgroundColor: alpha(C.blue, 0.08),
                    borderWidth: 1,
                    borderColor: alpha(C.blue, 0.3),
                    borderRadius: R.m,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '800' }}>NEXT</Text>
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '700' }}>
                      {fmtTime(scheduleContext.nextBlock.start)} – {fmtTime(scheduleContext.nextBlock.end)}
                    </Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginTop: 3 }}>
                    {scheduleContext.nextBlock.title}
                  </Text>
                  {scheduleContext.nextBlock.source === 'external' ? (
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                      External commitment
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Past blocks summary */}
              {scheduleContext.pastBlocks.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>PAST TODAY</Text>
                  {scheduleContext.pastBlocks.slice(-2).map((b) => (
                    <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={b.done ? 'checkmark-circle' : 'close-circle-outline'}
                          size={14}
                          color={b.done ? C.green : C.faint}
                        />
                        <Text style={{ color: b.done ? C.faint : C.text, fontSize: 12.5, textDecorationLine: b.done ? 'line-through' : 'none' }}>
                          {b.title}
                        </Text>
                      </View>
                      <Text style={{ color: C.faint, fontSize: 11 }}>
                        {fmtTime(b.start)}–{fmtTime(b.end)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          </Animated.View>
        ) : null}
        
        {/* 4. ADAPTIVE DAY STATUS */}
        {dayStatus && (
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: S.m }}>
            <Card
              style={{
                backgroundColor:
                  dayStatus.state === 'shifted'
                    ? alpha(C.amber, 0.08)
                    : dayStatus.state === 'on_track'
                    ? alpha(C.green, 0.08)
                    : C.surface,
                borderColor:
                  dayStatus.state === 'shifted'
                    ? alpha(C.amber, 0.4)
                    : dayStatus.state === 'on_track'
                    ? alpha(C.green, 0.4)
                    : C.border2,
                padding: S.m,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={
                      dayStatus.state === 'shifted'
                        ? 'alert-circle-outline'
                        : dayStatus.state === 'on_track'
                        ? 'checkmark-done-circle-outline'
                        : 'compass-outline'
                    }
                    size={16}
                    color={
                      dayStatus.state === 'shifted'
                        ? C.amber
                        : dayStatus.state === 'on_track'
                        ? C.green
                        : C.teal
                    }
                  />
                  <Label
                    style={{
                      color:
                        dayStatus.state === 'shifted'
                          ? C.amber
                          : dayStatus.state === 'on_track'
                          ? C.green
                          : C.teal,
                      fontWeight: '800',
                      letterSpacing: 0.8,
                    }}
                  >
                    {dayStatus.headline}
                  </Label>
                </View>

                {proposals.length > 0 && (
                  <Chip color={C.amber}>
                    <Text style={{ color: C.amber, fontSize: 11, fontWeight: '700' }}>
                      {proposals.length} adjustment{proposals.length > 1 ? 's' : ''} proposed
                    </Text>
                  </Chip>
                )}
              </View>

              <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>
                {dayStatus.summary}
              </Text>
              <Text style={{ color: C.sub, fontSize: 12.5, lineHeight: 17, marginTop: 3 }}>
                {dayStatus.explanation}
              </Text>

              {proposals.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: alpha(C.amber, 0.25),
                  }}
                >
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '600', flex: 1, marginRight: 8 }}>
                    Suggested adjustment available
                  </Text>
                  <Btn
                    variant="primary"
                    compact
                    icon="calendar-outline"
                    onPress={() => openRescheduleModal(proposals[0])}
                  >
                    Review Changes
                  </Btn>
                </View>
              ) : null}
            </Card>
          </Animated.View>
        )}

        {/* 5. ATTENTION / RADAR */}
        {radar.length > 0 ? (
          <>
            <SectionHeader
              title="LifeOS Radar"
              icon="radio-outline"
              right={`${radar.length} signals`}
            />
            {radar.slice(0, 3).map((r, i) => (
              <Animated.View key={r.id} entering={FadeInDown.delay(140 + i * 40).springify()}>
                <Card
                  style={{
                    marginBottom: S.s,
                    borderColor:
                      r.urgency === 'critical'
                        ? alpha(C.red, 0.4)
                        : r.urgency === 'high'
                        ? alpha(C.amber, 0.35)
                        : alpha(C.teal, 0.3),
                    backgroundColor:
                      r.urgency === 'critical'
                        ? alpha(C.red, 0.06)
                        : C.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.m }}>
                    <IconBadge
                      icon={
                        r.type === 'overdue_task'
                          ? 'alert-circle'
                          : r.type === 'spending'
                          ? 'trending-up'
                          : r.type === 'deadline'
                          ? 'time'
                          : r.type === 'project_deadline' || r.type === 'project_blocked'
                          ? 'folder'
                          : 'bulb'
                      }
                      color={
                        r.urgency === 'critical'
                          ? C.red
                          : r.urgency === 'high'
                          ? C.amber
                          : C.teal
                      }
                      size={36}
                      iconSize={18}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12, marginTop: 1 }}>
                        {r.subtitle}
                      </Text>
                    </View>
                    {r.actionText ? (
                      <Btn
                        variant={r.urgency === 'critical' ? 'primary' : 'secondary'}
                        compact
                        onPress={() => {
                          if (r.targetId && r.actionType === 'task') {
                            toggleTask(r.targetId);
                          } else if (r.targetId && r.actionType === 'reminder') {
                            rememberReminder(r.targetId);
                          } else if (r.actionType === 'money') {
                            navigation.navigate('Money');
                          } else if (r.actionType === 'project') {
                            navigation.navigate('Projects');
                          }
                        }}
                      >
                        {r.actionText}
                      </Btn>
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            ))}
          </>
        ) : null}

        {/* 5. TODAY'S HABITS */}
        {habitsSummary && habitsSummary.totalActive > 0 ? (
          <>
            <SectionHeader
              title="Today's Habits"
              icon="repeat-outline"
              right={`${habitsSummary.completedCount} / ${habitsSummary.totalActive} complete`}
              onRightPress={openHabitsModal}
            />
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <Card style={{ padding: S.m }}>
                {habitsSummary.habits.slice(0, 4).map((h, i) => {
                  const color = h.habit.color || C.violet;
                  return (
                    <Pressable
                      key={h.habit.id}
                      onPress={() => toggleHabit(h.habit.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 9,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: C.border,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: h.completed ? color : C.border,
                          backgroundColor: h.completed ? color : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {h.completed && <Ionicons name="checkmark" size={14} color={C.bg} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: h.completed ? C.faint : C.text,
                            fontSize: 14,
                            fontWeight: '700',
                            textDecorationLine: h.completed ? 'line-through' : 'none',
                          }}
                        >
                          {h.habit.name}
                        </Text>
                      </View>
                      {h.currentStreak > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="flame" size={12} color={C.amber} />
                          <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>
                            {h.currentStreak}d
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                  }}
                >
                  <Text style={{ color: C.faint, fontSize: 12 }}>
                    {habitsSummary.completedCount === habitsSummary.totalActive
                      ? 'All habits completed today ✨'
                      : `${habitsSummary.totalActive - habitsSummary.completedCount} left to do`}
                  </Text>
                  <Pressable onPress={openHabitsModal} hitSlop={8}>
                    <Text style={{ color: C.violet, fontSize: 12, fontWeight: '700' }}>Manage Habits →</Text>
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          </>
        ) : null}

        {/* 6. PROJECTS NEEDING ATTENTION */}
        {attentionProjects.length > 0 ? (
          <>
            <SectionHeader
              title="Projects Needing Attention"
              icon="folder-outline"
              right="View All"
              onRightPress={() => navigation.navigate('Projects')}
            />
            {attentionProjects.slice(0, 2).map((item, i) => {
              const col = item.project.color || C.blue;
              return (
                <Animated.View key={item.project.id} entering={FadeInDown.delay(160 + i * 40).springify()}>
                  <Card style={{ marginBottom: S.s, borderColor: alpha(col, 0.4) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <IconBadge
                        icon={(item.project.icon as any) || 'folder-outline'}
                        color={col}
                        size={36}
                        iconSize={18}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>
                          {item.project.name}
                        </Text>
                        <Text style={{ color: C.sub, fontSize: 12, marginTop: 1 }}>
                          {item.reason}
                        </Text>
                      </View>
                      <Btn
                        variant="secondary"
                        compact
                        onPress={() => navigation.navigate('Projects')}
                      >
                        View
                      </Btn>
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: C.faint, fontSize: 11 }}>
                          {item.stats.completed}/{item.stats.total} tasks
                        </Text>
                        <Text style={{ color: col, fontSize: 11, fontWeight: '800' }}>
                          {item.stats.pct}%
                        </Text>
                      </View>
                      <Bar pct={item.stats.pct} color={col} height={5} />
                    </View>

                    {item.project.deadline ? (
                      <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border2 }}>
                        <Text
                          style={{
                            color: getProjectDeadlinePressure(item.project, tasks, now, state.workDayStart, state.workDayEnd).isPressureHigh
                              ? C.amber
                              : C.faint,
                            fontSize: 11.5,
                            fontWeight: '600',
                          }}
                        >
                          {getProjectDeadlinePressure(item.project, tasks, now, state.workDayStart, state.workDayEnd).statusText}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                </Animated.View>
              );
            })}
          </>
        ) : null}

        {/* 7. DAILY REVIEW CARD */}
        {eveningSnapshot && (isEvening || eveningSnapshot.existingReview) ? (
          <>
            <SectionHeader
              title="Daily Review"
              icon="moon-outline"
              right={eveningSnapshot.existingReview ? 'Reviewed ✓' : 'Reflect on Today'}
              onRightPress={() => openReviewModal()}
            />
            <Animated.View entering={FadeInDown.delay(170).springify()}>
              <Card
                style={{
                  borderColor: eveningSnapshot.existingReview ? alpha(C.green, 0.4) : alpha(C.amber, 0.35),
                  backgroundColor: alpha(C.amber, 0.06),
                  padding: S.m,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>
                      {eveningSnapshot.existingReview ? 'Today’s Reflection Saved' : 'Time for Evening Review'}
                    </Text>
                    <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
                      {eveningSnapshot.completedTasksCount} tasks · {fmtDur(eveningSnapshot.focusMinutesToday)} focused · {eveningSnapshot.completedHabitsCount}/{eveningSnapshot.totalHabitsCount} habits
                    </Text>
                  </View>
                  <Btn
                    variant={eveningSnapshot.existingReview ? 'secondary' : 'primary'}
                    compact
                    icon="journal-outline"
                    onPress={() => openReviewModal()}
                  >
                    {eveningSnapshot.existingReview ? 'Edit' : 'Review Day'}
                  </Btn>
                </View>
              </Card>
            </Animated.View>
          </>
        ) : null}

        {/* WHAT NEEDS ATTENTION (Tasks) */}
        <SectionHeader
          title="What Needs Attention"
          icon="alert-circle-outline"
          right="All Tasks"
          onRightPress={() => navigation.navigate('Plan')}
        />
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Card>
            {attentionTasks.length === 0 ? (
              <View style={{ paddingVertical: 6, alignItems: 'center' }}>
                <Text style={{ color: C.green, fontSize: 13.5, fontWeight: '700' }}>
                  No urgent or overdue tasks right now ✨
                </Text>
              </View>
            ) : (
              attentionTasks.map((t, i) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: S.m,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: C.border,
                  }}
                >
                  <CheckCircle checked={t.done} onPress={() => toggleTask(t.id)} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: t.done ? C.faint : C.text,
                        fontSize: 14,
                        fontWeight: '700',
                        textDecorationLine: t.done ? 'line-through' : 'none',
                      }}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                      {dueLabel(t.dueTs)} · {t.tag || 'General'}
                      {t.projectId ? ` · ${projects.find((p) => p.id === t.projectId)?.name || 'Project'}` : ''}
                    </Text>
                  </View>
                  <PriorityBadge priority={t.priority} />
                </View>
              ))
            )}
          </Card>
        </Animated.View>

        {/* TODAY'S PLAN (Schedule Blocks) */}
        <SectionHeader
          title="Today's Plan"
          icon="calendar-outline"
          right="View Timeline"
          onRightPress={() => navigation.navigate('Plan')}
        />
        <Animated.View entering={FadeInDown.delay(220).springify()}>
          <Card style={{ borderColor: current ? alpha(TYPE_META[current.type].color, 0.35) : C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: current ? C.green : C.amber,
                }}
              />
              <Label style={{ color: current ? C.green : C.amber }}>
                {current ? 'Ongoing Block' : 'Upcoming Next'}
              </Label>
              <View style={{ flex: 1 }} />
              <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700' }}>
                {now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>

            {current ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.m }}>
                  <IconBadge
                    icon={TYPE_META[current.type].icon as any}
                    color={TYPE_META[current.type].color}
                    size={42}
                    iconSize={20}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{current.title}</Text>
                    <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                      Until {fmtTime(current.end)}
                      {next ? `  ·  then ${next.title} at ${fmtTime(next.start)}` : ''}
                    </Text>
                  </View>
                  <CheckCircle
                    checked={current.done}
                    color={TYPE_META[current.type].color}
                    onPress={() => toggleBlock(current.id)}
                  />
                </View>
                <View style={{ marginTop: S.m }}>
                  <Bar pct={progress} color={TYPE_META[current.type].color} />
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 5, fontWeight: '600' }}>
                    {progress}% through this block
                  </Text>
                </View>
              </>
            ) : next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.m }}>
                <IconBadge icon="hourglass-outline" color={C.amber} size={42} iconSize={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>Free window</Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                    Next: {next.title} at {fmtTime(next.start)}
                  </Text>
                </View>
                <Btn title="Plan Day" variant="ghost" compact onPress={() => navigation.navigate('Plan')} />
              </View>
            ) : (
              <Text style={{ color: C.sub, fontSize: 14 }}>All blocks completed for today 🌙</Text>
            )}
          </Card>
        </Animated.View>

        {/* MONEY TODAY */}
        <SectionHeader
          title="Money Today"
          icon="wallet-outline"
          right="View Spends"
          onRightPress={() => navigation.navigate('Money')}
        />
        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Label>Spent Today</Label>
                <Text style={{ color: C.text, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
                  {inr(money.todayTotal)}
                </Text>
                <Text
                  style={{
                    color: money.remainingDaily >= 0 ? C.green : C.red,
                    fontSize: 12.5,
                    fontWeight: '700',
                    marginTop: 2,
                  }}
                >
                  {money.remainingDaily >= 0
                    ? `${inr(money.remainingDaily)} remaining from today's target`
                    : `${inr(Math.abs(money.remainingDaily))} over daily target`}
                </Text>
              </View>
              <Btn
                title="+ Spend"
                compact
                icon="add"
                onPress={openExpense}
              />
            </View>

            {/* Spend pills */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: S.m, flexWrap: 'wrap' }}>
              {money.byCat.map((c) => (
                <Chip key={c.cat} color={C.amber}>
                  <Text style={{ color: C.text, fontSize: 11, fontWeight: '700' }}>
                    {c.cat.toUpperCase()}: {inr(c.total)}
                  </Text>
                </Chip>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* REMINDERS / DON'T FORGET */}
        <SectionHeader
          title="Don't Forget"
          icon="bulb-outline"
          right="+ Add"
          onRightPress={openReminder}
        />
        {newDetections.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(280 + i * 40).springify()}>
            <Card style={{ marginBottom: S.s, borderColor: alpha(C.violet, 0.4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="sparkles" size={13} color={C.violet} />
                <Text style={{ color: C.violet, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                  {r.source.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{r.title}</Text>
              <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>{dueLabel(r.dueTs)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: S.m }}>
                <Btn title="Remember it" compact icon="checkmark" onPress={() => rememberReminder(r.id)} />
                <Btn title="Dismiss" compact variant="ghost" onPress={() => dismissReminder(r.id)} />
              </View>
            </Card>
          </Animated.View>
        ))}

        <Card>
          {trackedReminders.length === 0 ? (
            <Text style={{ color: C.faint, fontSize: 13 }}>No active reminders — everything is clear ✨</Text>
          ) : (
            trackedReminders.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => completeReminder(r.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: S.m,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}
              >
                <IconBadge
                  icon={(r.icon as any) || 'notifications-outline'}
                  color={dueLabel(r.dueTs).includes('today') ? C.amber : C.sub}
                  size={34}
                  iconSize={16}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{r.source}</Text>
                </View>
                <Chip color={dueLabel(r.dueTs).includes('today') ? C.amber : C.sub}>
                  <Text
                    style={{
                      color: dueLabel(r.dueTs).includes('today') ? C.amber : C.sub,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {dueLabel(r.dueTs)}
                  </Text>
                </Chip>
                <CheckCircle checked={false} color={C.green} />
              </Pressable>
            ))
          )}
        </Card>

        {/* LIFEOS SUGGESTION */}
        <Animated.View entering={FadeInDown.delay(320).springify()}>
          <Card
            style={{
              marginTop: S.xl,
              backgroundColor: alpha(C.violet, 0.08),
              borderColor: alpha(C.violet, 0.35),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.s }}>
              <Ionicons name="sparkles" size={16} color={C.violet} />
              <Label style={{ color: C.violet }}>LifeOS Suggestion</Label>
            </View>
            <Text style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>
              {money.spendingInsight}
            </Text>
            <Btn
              title="Ask LifeOS anything"
              icon="sparkles-outline"
              variant="violet"
              onPress={openAsk}
              style={{ marginTop: S.m }}
            />
          </Card>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
