import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Btn,
  Card,
  CheckCircle,
  Chip,
  EmptyState,
  IconBadge,
  Label,
  PriorityBadge,
  SectionHeader,
} from '../components/ui';
import {
  daysUntil,
  dueLabel,
  fmtDateShort,
  fmtDur,
  fmtTime,
  isOverdueDay,
  isToday,
} from '../lib/dates';
import { searchLifeOS, TYPE_META } from '../lib/engine';
import { SEED_INPUT } from '../lib/seed';
import { useStore, useUI } from '../lib/store';
import type { ScheduleBlock, SearchFilter, Task } from '../types';
import { alpha, C, R, S, shadow } from '../theme';

import { WeeklyPlanView } from '../components/WeeklyPlanView';

const EXAMPLES = [
  SEED_INPUT,
  'College from 9 to 1, gym for 1 hour, study 2 hours, buy toothpaste',
  'Meeting at 11, finish project report, groceries, dinner at 8',
];

export function PlannerScreen() {
  const {
    state,
    generateSchedule,
    toggleBlock,
    toggleTask,
    updateNotificationPreferences,
    syncExternalCalendar,
    disconnectCalendar,
    exportStateData,
    importStateData,
    deletePersonalPreference,
  } = useStore();
  const { openTask, openFocusModal, openBreakdownModal } = useUI();
  const [activeTab, setActiveTab] = useState<'tasks' | 'schedule' | 'weekly' | 'settings'>('tasks');
  const [input, setInput] = useState(state?.scheduleInput ?? '');
  const [thinking, setThinking] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');

  // Export / Import state
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);

  const searchResults = useMemo(() => {
    if (!state || !searchQuery.trim()) return { items: [], total: 0 };
    return searchLifeOS(state, searchQuery.trim(), searchFilter);
  }, [state, searchQuery, searchFilter]);

  const schedule = state?.schedule ?? [];
  const tasks = state?.tasks ?? [];
  const projects = state?.projects ?? [];

  // Categorize tasks into Overdue, Today, Upcoming, Completed
  const taskGroups = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];

    for (const t of tasks) {
      if (t.done) {
        completed.push(t);
      } else if (isOverdueDay(t.dueTs) && !isToday(t.dueTs)) {
        overdue.push(t);
      } else if (isToday(t.dueTs)) {
        today.push(t);
      } else {
        upcoming.push(t);
      }
    }

    // Sort active tasks by priority (critical > important > normal)
    const prioOrder = { critical: 0, important: 1, normal: 2 };
    const sortFn = (a: Task, b: Task) => {
      if (prioOrder[a.priority] !== prioOrder[b.priority]) {
        return prioOrder[a.priority] - prioOrder[b.priority];
      }
      return a.dueTs - b.dueTs;
    };

    return {
      overdue: overdue.sort(sortFn),
      today: today.sort(sortFn),
      upcoming: upcoming.sort(sortFn),
      completed: completed.sort((a, b) => b.createdAt - a.createdAt),
    };
  }, [tasks]);

  const generate = () => {
    if (!input.trim() || thinking) return;
    setThinking(true);
    setTimeout(() => {
      generateSchedule(input.trim());
      setThinking(false);
    }, 850);
  };

  const focusMin = schedule
    .filter((b) => (b.type === 'study' || b.type === 'work') && b.done)
    .reduce((s, b) => s + (b.end - b.start), 0);
  const plannedMin = schedule.reduce((s, b) => s + (b.end - b.start), 0);

  const renderTaskItem = (item: Task) => {
    const proj = item.projectId ? projects.find((p) => p.id === item.projectId) : null;
    return (
      <Pressable
        key={item.id}
        onPress={() => openTask(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.m,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <CheckCircle
          checked={item.done}
          color={item.priority === 'critical' ? C.red : C.green}
          onPress={() => toggleTask(item.id)}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: item.done ? C.faint : C.text,
              fontSize: 14.5,
              fontWeight: '700',
              textDecorationLine: item.done ? 'line-through' : 'none',
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Text style={{ color: C.faint, fontSize: 11.5 }}>
              {dueLabel(item.dueTs)}
            </Text>
            {item.tag ? (
              <>
                <Text style={{ color: C.faint, fontSize: 10 }}>•</Text>
                <Text style={{ color: C.sub, fontSize: 11.5 }}>{item.tag}</Text>
              </>
            ) : null}
            {proj ? (
              <>
                <Text style={{ color: C.faint, fontSize: 10 }}>•</Text>
                <Text style={{ color: proj.color || C.blue, fontSize: 11.5, fontWeight: '700' }}>
                  {proj.name}
                </Text>
              </>
            ) : null}
            {item.note ? (
              <>
                <Text style={{ color: C.faint, fontSize: 10 }}>•</Text>
                <Text style={{ color: C.faint, fontSize: 11.5 }} numberOfLines={1}>
                  {item.note}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <PriorityBadge priority={item.priority} />
        {!item.done ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              openFocusModal(item.id);
            }}
            hitSlop={8}
            style={{
              padding: 5,
              borderRadius: 6,
              backgroundColor: alpha(C.violet, 0.15),
            }}
          >
            <Ionicons name="flash-outline" size={14} color={C.violet} />
          </Pressable>
        ) : null}
        <Ionicons name="create-outline" size={16} color={C.faint} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top Header */}
        <View style={{ paddingHorizontal: S.l, paddingTop: S.m, paddingBottom: S.s }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>Tasks & Planning</Text>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>
                Prioritized execution & natural schedule building
              </Text>
            </View>
            <Chip color={C.amber}>
              <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>
                {tasks.filter((t) => !t.done).length} pending
              </Text>
            </Chip>
          </View>

          {/* Segmented Switch */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: C.surface2,
              borderRadius: R.pill,
              padding: 4,
              marginTop: S.m,
            }}
          >
            <Pressable
              onPress={() => setActiveTab('tasks')}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 7,
                borderRadius: R.pill,
                backgroundColor: activeTab === 'tasks' ? C.amber : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === 'tasks' ? '#1A1206' : C.sub,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                Tasks ({tasks.filter((t) => !t.done).length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('schedule')}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 7,
                borderRadius: R.pill,
                backgroundColor: activeTab === 'schedule' ? C.violet : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === 'schedule' ? '#150F24' : C.sub,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                Timeline ({schedule.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('weekly')}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 7,
                borderRadius: R.pill,
                backgroundColor: activeTab === 'weekly' ? C.teal : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === 'weekly' ? '#072421' : C.sub,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                Weekly
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('settings')}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 7,
                borderRadius: R.pill,
                backgroundColor: activeTab === 'settings' ? C.blue : 'transparent',
              }}
            >
              <Text
                style={{
                  color: activeTab === 'settings' ? '#07182E' : C.sub,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                Tools
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'tasks' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Quick Actions: Add Task & Breakdown */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: S.l }}>
              <Pressable
                onPress={() => openTask()}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: alpha(C.amber, 0.12),
                  borderRadius: R.xl,
                  borderWidth: 1.5,
                  borderColor: alpha(C.amber, 0.4),
                  padding: S.m,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: C.amber,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={18} color="#1A1206" />
                </View>
                <Text style={{ color: C.amber, fontSize: 13, fontWeight: '800' }}>
                  Add Task
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openBreakdownModal()}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: alpha(C.violet, 0.12),
                  borderRadius: R.xl,
                  borderWidth: 1.5,
                  borderColor: alpha(C.violet, 0.4),
                  padding: S.m,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: C.violet,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="git-branch-outline" size={16} color="#150F24" />
                </View>
                <Text style={{ color: C.violet, fontSize: 13, fontWeight: '800' }}>
                  Break Down
                </Text>
              </Pressable>
            </View>

            {/* Overdue Tasks */}
            {taskGroups.overdue.length > 0 ? (
              <Animated.View entering={FadeInDown.springify()}>
                <SectionHeader
                  title="Overdue"
                  icon="alert-circle"
                  right={`${taskGroups.overdue.length} need attention`}
                />
                <Card style={{ borderColor: alpha(C.red, 0.4), backgroundColor: alpha(C.red, 0.05) }}>
                  {taskGroups.overdue.map(renderTaskItem)}
                </Card>
              </Animated.View>
            ) : null}

            {/* Today's Tasks */}
            <Animated.View entering={FadeInDown.delay(60).springify()}>
              <SectionHeader
                title="Today"
                icon="today-outline"
                right={`${taskGroups.today.length} tasks`}
              />
              <Card>
                {taskGroups.today.length === 0 ? (
                  <Text style={{ color: C.faint, fontSize: 13, paddingVertical: 4 }}>
                    No pending tasks for today. Tap "+ Add" above to add one!
                  </Text>
                ) : (
                  taskGroups.today.map(renderTaskItem)
                )}
              </Card>
            </Animated.View>

            {/* Upcoming Tasks */}
            {taskGroups.upcoming.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(120).springify()}>
                <SectionHeader
                  title="Upcoming"
                  icon="calendar-outline"
                  right={`${taskGroups.upcoming.length} upcoming`}
                />
                <Card>
                  {taskGroups.upcoming.map(renderTaskItem)}
                </Card>
              </Animated.View>
            ) : null}

            {/* Completed Tasks */}
            {taskGroups.completed.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(180).springify()}>
                <SectionHeader
                  title="Completed"
                  icon="checkmark-done-outline"
                  right={`${taskGroups.completed.length} done`}
                />
                <Card>
                  {taskGroups.completed.map(renderTaskItem)}
                </Card>
              </Animated.View>
            ) : null}
          </ScrollView>
        ) : activeTab === 'schedule' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Natural Language Day Generator */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="sparkles" size={15} color={C.violet} />
                <Label style={{ color: C.violet }}>Natural Schedule Generator</Label>
              </View>
              <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                placeholder='e.g. "I have college at 10, need to study 3 hours, buy groceries and finish assignment."'
                placeholderTextColor={C.faint}
                style={{
                  color: C.text,
                  fontSize: 14.5,
                  lineHeight: 21,
                  minHeight: 70,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: S.m }}>
                {EXAMPLES.map((ex, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setInput(ex)}
                    style={({ pressed }) => ({
                      borderRadius: R.pill,
                      backgroundColor: C.surface2,
                      borderWidth: 1,
                      borderColor: C.border,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: C.sub, fontSize: 11.5, fontWeight: '600' }} numberOfLines={1}>
                      {ex.length > 40 ? ex.slice(0, 40) + '…' : ex}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Btn
                title={thinking ? 'Building Schedule…' : 'Generate Timeline'}
                icon={thinking ? undefined : 'sparkles'}
                loading={thinking}
                onPress={generate}
                style={{ marginTop: S.m }}
              />
            </Card>

            {/* Generated Schedule Timeline */}
            {schedule.length > 0 ? (
              <View style={{ marginTop: S.l }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.m }}>
                  <Chip color={C.amber}>
                    <Text style={{ color: C.amber, fontSize: 11.5, fontWeight: '800' }}>
                      {schedule.length} blocks · {fmtDur(plannedMin)}
                    </Text>
                  </Chip>
                  <Chip color={C.green}>
                    <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '800' }}>
                      {fmtDur(focusMin)} focus done
                    </Text>
                  </Chip>
                </View>

                <SectionHeader title="Generated Timeline" icon="time-outline" right="Tap to mark done" />

                {schedule.map((item, index) => {
                  const meta = TYPE_META[item.type];
                  return (
                    <Animated.View
                      key={item.id}
                      entering={FadeInLeft.delay(Math.min(index * 40, 400)).springify()}
                    >
                      <Pressable
                        onPress={() => toggleBlock(item.id)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          gap: S.m,
                          borderRadius: R.xl,
                          backgroundColor: C.surface,
                          borderWidth: 1,
                          borderColor: item.done ? alpha(C.green, 0.3) : C.border,
                          padding: S.l,
                          marginBottom: S.s,
                          opacity: pressed ? 0.8 : item.done ? 0.55 : 1,
                        })}
                      >
                        <View style={{ width: 64 }}>
                          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>
                            {fmtTime(item.start)}
                          </Text>
                          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>
                            {fmtTime(item.end)}
                          </Text>
                          <Text style={{ color: C.faint, fontSize: 10, marginTop: 4, fontWeight: '600' }}>
                            {fmtDur(item.end - item.start)}
                          </Text>
                        </View>
                        <View style={{ width: 3, borderRadius: 2, backgroundColor: alpha(meta.color, 0.55) }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 10,
                                backgroundColor: alpha(meta.color, 0.14),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons
                                name={meta.icon as keyof typeof Ionicons.glyphMap}
                                size={15}
                                color={meta.color}
                              />
                            </View>
                            <Text
                              style={{
                                flex: 1,
                                color: C.text,
                                fontSize: 14.5,
                                fontWeight: '700',
                                textDecorationLine: item.done ? 'line-through' : 'none',
                              }}
                            >
                              {item.title}
                            </Text>
                            <CheckCircle checked={item.done} color={C.green} />
                          </View>
                          {item.note ? (
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                              <Ionicons name="sparkles" size={12} color={C.violet} style={{ marginTop: 2 }} />
                              <Text style={{ flex: 1, color: C.violet, fontSize: 12, lineHeight: 17 }}>
                                {item.note}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon="calendar-outline"
                title="No Day Timeline Built"
                sub="Type what you want to do today above to build a realistic schedule."
              />
            )}
          </ScrollView>
        ) : activeTab === 'weekly' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <WeeklyPlanView />
          </ScrollView>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. LOCAL SEARCH */}
            <Card style={{ marginBottom: S.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
                <Ionicons name="search" size={18} color={C.blue} />
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>Local Search</Text>
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search tasks, projects, goals, history..."
                placeholderTextColor={C.faint}
                style={{
                  backgroundColor: C.surface2,
                  borderRadius: R.m,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: C.text,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: C.border,
                  marginBottom: S.s,
                }}
              />
              {/* Filter chips */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.m }}>
                {(['all', 'tasks', 'projects', 'goals', 'history'] as SearchFilter[]).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setSearchFilter(f)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: R.pill,
                      backgroundColor: searchFilter === f ? alpha(C.blue, 0.25) : C.surface2,
                      borderWidth: 1,
                      borderColor: searchFilter === f ? C.blue : C.border,
                    }}
                  >
                    <Text
                      style={{
                        color: searchFilter === f ? C.blue : C.faint,
                        fontSize: 11,
                        fontWeight: '700',
                        textTransform: 'capitalize',
                      }}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {searchQuery.trim() ? (
                searchResults.items.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {searchResults.items.slice(0, 8).map((item) => (
                      <View
                        key={`${item.category}-${item.id}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 10,
                          borderRadius: R.m,
                          backgroundColor: C.surface2,
                        }}
                      >
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            borderRadius: 4,
                            backgroundColor: alpha(C.blue, 0.2),
                          }}
                        >
                          <Text style={{ color: C.blue, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                            {item.category}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text style={{ color: C.faint, fontSize: 11 }} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: C.faint, fontSize: 12, fontStyle: 'italic' }}>
                    No results found for "{searchQuery}".
                  </Text>
                )
              ) : null}
            </Card>

            {/* 2. NOTIFICATION CENTER */}
            <Card style={{ marginBottom: S.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.m }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="notifications-outline" size={18} color={C.amber} />
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>Notification Center</Text>
                </View>
                <Pressable
                  onPress={() =>
                    updateNotificationPreferences({
                      enabled: !state?.notificationPreferences?.enabled,
                    })
                  }
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: R.pill,
                    backgroundColor: state?.notificationPreferences?.enabled
                      ? alpha(C.green, 0.2)
                      : alpha(C.red, 0.2),
                  }}
                >
                  <Text
                    style={{
                      color: state?.notificationPreferences?.enabled ? C.green : C.red,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {state?.notificationPreferences?.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </Pressable>
              </View>

              <View style={{ gap: 8 }}>
                {[
                  {
                    key: 'taskReminders' as const,
                    label: 'Task Reminders',
                    sub: 'Alerts at planned times or before deadlines',
                  },
                  {
                    key: 'deadlineReminders' as const,
                    label: 'Deadline Reminders',
                    sub: 'Advance warnings for approaching due dates',
                  },
                  {
                    key: 'routineReminders' as const,
                    label: 'Routine Reminders',
                    sub: 'Prompt morning and evening launch routines',
                  },
                  {
                    key: 'weeklyReviewReminder' as const,
                    label: 'Weekly Review',
                    sub: 'Sunday evening review prompt',
                  },
                ].map((item) => {
                  const active = !!state?.notificationPreferences?.[item.key];
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() =>
                        updateNotificationPreferences({
                          [item.key]: !active,
                        })
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        borderRadius: R.m,
                        backgroundColor: C.surface2,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{item.label}</Text>
                        <Text style={{ color: C.faint, fontSize: 11 }}>{item.sub}</Text>
                      </View>
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={active ? C.green : C.faint}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={{
                  marginTop: S.m,
                  padding: 10,
                  borderRadius: R.m,
                  backgroundColor: alpha(C.violet, 0.12),
                  borderWidth: 1,
                  borderColor: alpha(C.violet, 0.25),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="moon-outline" size={14} color={C.violet} />
                  <Text style={{ color: C.violet, fontSize: 12, fontWeight: '800' }}>
                    Quiet Hours: 22:30 → 07:00
                  </Text>
                </View>
                <Text style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>
                  Non-urgent notifications scheduled during quiet hours are delayed until morning.
                </Text>
              </View>
            </Card>

            {/* 3. CALENDAR INTEGRATION */}
            <Card style={{ marginBottom: S.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.m }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar-outline" size={18} color={C.teal} />
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>External Calendar</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: R.pill,
                    backgroundColor:
                      state?.calendarSync?.status === 'synced'
                        ? alpha(C.green, 0.2)
                        : alpha(C.faint, 0.2),
                  }}
                >
                  <Text
                    style={{
                      color: state?.calendarSync?.status === 'synced' ? C.green : C.faint,
                      fontSize: 11,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                    }}
                  >
                    {state?.calendarSync?.status ?? 'NEVER SYNCED'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: C.sub, fontSize: 12, marginBottom: S.m }}>
                External calendar events import as read-only commitments. They reduce usable time and guide recommendations, but LifeOS will never modify or delete them.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.m }}>
                <Btn
                  title="Import Events"
                  variant="secondary"
                  size="small"
                  icon="download-outline"
                  onPress={() => {
                    const sampleEvents = [
                      {
                        id: 'dept-meeting',
                        calendarId: 'default',
                        title: 'Department Sync',
                        start: 11 * 60,
                        end: 12 * 60,
                      },
                      {
                        id: 'office-hours',
                        calendarId: 'default',
                        title: 'Faculty Office Hours',
                        start: 15 * 60,
                        end: 16 * 60,
                      },
                    ];
                    syncExternalCalendar(sampleEvents, 'Device Calendar');
                  }}
                />
                {state?.calendarSync?.status === 'synced' ? (
                  <Btn
                    title="Disconnect"
                    variant="ghost"
                    size="small"
                    onPress={() => disconnectCalendar()}
                  />
                ) : null}
              </View>

              <Text style={{ color: C.faint, fontSize: 11 }}>
                Events imported: {(state?.externalCalendarEvents ?? []).length}
                {state?.calendarSync?.lastSyncedAt
                  ? ` • Last synced: ${fmtDateShort(state.calendarSync.lastSyncedAt)}`
                  : ''}
              </Text>
            </Card>

            {/* 4. DATA EXPORT & IMPORT */}
            <Card style={{ marginBottom: S.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
                <Ionicons name="cloud-download-outline" size={18} color={C.green} />
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>Backup & Restore</Text>
              </View>

              <Text style={{ color: C.sub, fontSize: 12, marginBottom: S.m }}>
                Export your complete LifeOS state to human-readable JSON, or restore from a previous backup safely.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.m }}>
                <Btn
                  title="Export JSON"
                  variant="secondary"
                  size="small"
                  icon="share-outline"
                  onPress={() => {
                    const data = exportStateData();
                    setExportedJson(data);
                  }}
                />
              </View>

              {exportedJson ? (
                <View style={{ marginBottom: S.m }}>
                  <Text style={{ color: C.faint, fontSize: 10, fontWeight: '700', marginBottom: 4 }}>
                    EXPORTED STATE JSON (READ-ONLY)
                  </Text>
                  <TextInput
                    value={exportedJson}
                    editable={false}
                    multiline
                    numberOfLines={4}
                    style={{
                      backgroundColor: C.surface2,
                      borderRadius: R.m,
                      padding: 8,
                      color: C.faint,
                      fontSize: 10,
                      maxHeight: 120,
                    }}
                  />
                </View>
              ) : null}

              {/* Import Section */}
              <View style={{ marginTop: S.s }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                  Restore Backup
                </Text>
                <TextInput
                  value={importInput}
                  onChangeText={(t) => {
                    setImportInput(t);
                    setImportFeedback(null);
                  }}
                  placeholder="Paste exported JSON here to restore..."
                  placeholderTextColor={C.faint}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: C.surface2,
                    borderRadius: R.m,
                    padding: 8,
                    color: C.text,
                    fontSize: 11,
                    maxHeight: 100,
                    borderWidth: 1,
                    borderColor: C.border,
                    marginBottom: S.s,
                  }}
                />

                {confirmingImport ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: R.m,
                      backgroundColor: alpha(C.red, 0.15),
                      borderWidth: 1,
                      borderColor: alpha(C.red, 0.3),
                      marginBottom: S.s,
                    }}
                  >
                    <Text style={{ color: C.red, fontWeight: '800', fontSize: 12 }}>
                      Replace LifeOS data?
                    </Text>
                    <Text style={{ color: C.sub, fontSize: 11, marginVertical: 4 }}>
                      Existing data will be replaced. In-memory backup protects against malformed state.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <Btn
                        title="Confirm Replace"
                        variant="primary"
                        size="small"
                        onPress={() => {
                          const res = importStateData(importInput, 'replace');
                          setConfirmingImport(false);
                          if (res.success) {
                            setImportFeedback('Data successfully restored!');
                            setImportInput('');
                          } else {
                            setImportFeedback(res.error || 'Import failed.');
                          }
                        }}
                      />
                      <Btn
                        title="Cancel"
                        variant="ghost"
                        size="small"
                        onPress={() => setConfirmingImport(false)}
                      />
                    </View>
                  </View>
                ) : (
                  <Btn
                    title="Import JSON"
                    variant="secondary"
                    size="small"
                    onPress={() => {
                      if (!importInput.trim()) return;
                      setConfirmingImport(true);
                    }}
                  />
                )}

                {importFeedback ? (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: '700',
                      color: importFeedback.includes('successfully') ? C.green : C.red,
                    }}
                  >
                    {importFeedback}
                  </Text>
                ) : null}
              </View>
            </Card>

            {/* 5. PERSONAL MEMORY */}
            {(state?.personalPreferences ?? []).length > 0 ? (
              <Card style={{ marginBottom: S.l }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.m }}>
                  <Ionicons name="finger-print-outline" size={18} color={C.violet} />
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>What LifeOS Knows</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {state?.personalPreferences?.map((p) => (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 8,
                        borderRadius: R.m,
                        backgroundColor: C.surface2,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{p.key}</Text>
                        <Text style={{ color: C.faint, fontSize: 11 }}>{p.value}</Text>
                      </View>
                      <Pressable onPress={() => deletePersonalPreference(p.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={C.red} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
          </ScrollView>
        )}

        {/* FAB: Add Task */}
        {activeTab === 'tasks' ? (
          <Pressable
            onPress={() => openTask()}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 20,
              bottom: 104,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: C.amber,
              borderRadius: R.pill,
              paddingHorizontal: 18,
              paddingVertical: 13,
              opacity: pressed ? 0.85 : 1,
              ...shadow,
            })}
          >
            <Ionicons name="add" size={20} color="#1A1206" />
            <Text style={{ color: '#1A1206', fontWeight: '800', fontSize: 14 }}>New Task</Text>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
