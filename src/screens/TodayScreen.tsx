import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
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
  dueLabel,
  fmtDateLong,
  fmtTime,
  greeting,
  nowMinutes,
  useNow,
} from '../lib/dates';
import {
  getLifeOSRadar,
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
  } = useStore();
  const { openAsk, openExpense, openNowModal, openTask, openReminder } = useUI();
  const now = useNow(30000);

  const schedule = state?.schedule ?? [];
  const { current, next } = nowBlock(schedule, now);
  const money = useMemo(
    () => (state ? moneyInsights(state.expenses, state.weeklyBudget, state.dailyBudget, state.monthlyBudget) : null),
    [state]
  );
  const radar = useMemo(() => (state ? getLifeOSRadar(state) : []), [state]);
  const whatNow = useMemo(() => (state ? getWhatToDoNow(state) : null), [state]);

  if (!state || !money) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const progress = current ? Math.round(((nowMinutes(now) - current.start) / (current.end - current.start)) * 100) : 0;

  // Urgent/Critical Attention Items
  const attentionTasks = state.tasks
    .filter((t) => !t.done && (t.priority === 'critical' || t.priority === 'important'))
    .slice(0, 3);

  const newDetections = state.reminders.filter((r) => r.status === 'new');
  const trackedReminders = state.reminders
    .filter((r) => r.status === 'tracked')
    .sort((a, b) => a.dueTs - b.dueTs)
    .slice(0, 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: S.l, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: Date & Greeting */}
        <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>
              {greeting(now)}, {state.name} ☀️
            </Text>
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{fmtDateLong(now)}</Text>
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

        {/* Status Chips */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={{ flexDirection: 'row', gap: 8, marginTop: S.m }}>
          <Chip color={C.amber}>
            <Ionicons name="flame" size={13} color={C.amber} />
            <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>{state.reportStreak}-day streak</Text>
          </Chip>
          <Chip color={C.blue}>
            <Ionicons name="calendar-outline" size={13} color={C.blue} />
            <Text style={{ color: C.blue, fontSize: 12, fontWeight: '700' }}>
              {state.tasks.filter((t) => t.done).length}/{state.tasks.length} tasks done
            </Text>
          </Chip>
        </Animated.View>

        {/* 1. PROMINENT "What Should I Do Now?" BUTTON / HERO CARD */}
        {whatNow ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Pressable
              onPress={openNowModal}
              style={({ pressed }) => ({
                marginTop: S.l,
                borderRadius: R.xl,
                backgroundColor: alpha(C.violet, 0.14),
                borderWidth: 1.5,
                borderColor: alpha(C.violet, 0.45),
                padding: S.l,
                opacity: pressed ? 0.9 : 1,
                ...shadow,
              })}
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
                  <Ionicons name="sparkles" size={14} color={C.violet} />
                </View>
                <Label style={{ color: C.violet, fontSize: 11.5, fontWeight: '800' }}>
                  What Should I Do Now?
                </Label>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={18} color={C.violet} />
              </View>

              <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                {whatNow.actionTitle}
              </Text>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                {whatNow.reason}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.m }}>
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
                {whatNow.durationMins ? (
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '600' }}>
                    ~{whatNow.durationMins} mins
                  </Text>
                ) : null}
                <View style={{ flex: 1 }} />
                <Text style={{ color: C.violet, fontSize: 12, fontWeight: '800' }}>
                  Tap to act →
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* 2. LIFEOS RADAR SECTION */}
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
                        title={r.actionText}
                        compact
                        variant={r.urgency === 'critical' ? 'danger' : 'ghost'}
                        onPress={() => {
                          if (r.targetId && r.actionType === 'task') {
                            toggleTask(r.targetId);
                          } else if (r.targetId && r.actionType === 'reminder') {
                            rememberReminder(r.targetId);
                          } else if (r.actionType === 'money') {
                            navigation.navigate('Money');
                          }
                        }}
                      />
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            ))}
          </>
        ) : null}

        {/* 3. WHAT NEEDS ATTENTION */}
        <SectionHeader
          title="What Needs Attention"
          icon="alert-circle-outline"
          right="Tasks & Deadlines"
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
                    </Text>
                  </View>
                  <PriorityBadge priority={t.priority} />
                </View>
              ))
            )}
          </Card>
        </Animated.View>

        {/* 4. TODAY'S PLAN (Schedule Blocks) */}
        <SectionHeader
          title="Today's Plan"
          icon="calendar-outline"
          right="View full schedule"
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

        {/* 5. MONEY TODAY SUMMARY */}
        <SectionHeader
          title="Money Today"
          icon="wallet-outline"
          right="View all spends"
          onRightPress={() => navigation.navigate('Money')}
        />
        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Label>Spent Today</Label>
                <Text style={{ color: C.text, fontSize: 32, fontWeight: '800', marginTop: 2 }}>
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

            {/* Quick spend category pills */}
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

        {/* 6. DON'T FORGET (Reminders) */}
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

        {/* 7. LIFEOS SUGGESTION */}
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
              {money.spendingInsight} Protect your evening focus window for Digital Electronics revision.
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
