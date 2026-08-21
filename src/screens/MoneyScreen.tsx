import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BudgetSheet } from '../components/BudgetSheet';
import { Bar, Card, Chip, EmptyState, IconBadge, Label, SectionHeader } from '../components/ui';
import { fmtClock, fmtDateShort } from '../lib/dates';
import { CAT_META, moneyInsights } from '../lib/engine';
import { useStore, useUI } from '../lib/store';
import type { ExpenseCategory } from '../types';
import { alpha, C, inr, R, S, shadow } from '../theme';

export function MoneyScreen() {
  const { state, deleteExpense } = useStore();
  const { openExpense } = useUI();
  const [viewFilter, setViewFilter] = useState<'today' | 'week' | 'all'>('today');
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetViewMode, setBudgetViewMode] = useState<'week' | 'month'>('week');

  const money = useMemo(
    () => (state ? moneyInsights(state.expenses, state.weeklyBudget, state.dailyBudget, state.monthlyBudget) : null),
    [state]
  );

  if (!state || !money) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const monthlyBudget = state.monthlyBudget || Math.round(state.weeklyBudget * (30 / 7));
  const maxDay = Math.max(...money.last7.map((d) => d.total), 1);
  const maxCat = Math.max(...money.byCat.map((c) => c.total), 1);
  const weekPct = Math.min(100, Math.round((money.weekSpent / state.weeklyBudget) * 100));
  const monthPct = Math.min(100, Math.round((money.monthSpent / monthlyBudget) * 100));

  const filteredExpenses = useMemo(() => {
    if (viewFilter === 'today') return money.today;
    if (viewFilter === 'week') {
      const weekStart = Date.now() - 7 * 86400000;
      return state.expenses.filter((e) => e.ts >= weekStart).sort((a, b) => b.ts - a.ts);
    }
    return [...state.expenses].sort((a, b) => b.ts - a.ts);
  }, [viewFilter, money.today, state.expenses]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: S.l, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>Money & Insights</Text>
                <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>Spending awareness & budget control</Text>
              </View>
              <Pressable onPress={() => setBudgetSheetOpen(true)} hitSlop={6}>
                <Chip color={C.amber}>
                  <Ionicons name="options-outline" size={13} color={C.amber} />
                  <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>
                    {inr(state.weeklyBudget)}/wk · Edit
                  </Text>
                </Chip>
              </Pressable>
            </Animated.View>

            {/* 1. TODAY / WEEK / MONTH TOTALS */}
            <Animated.View entering={FadeInDown.delay(60).springify()}>
              <Card style={{ marginTop: S.l }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label>Today's Spending</Label>
                  <Pressable
                    onPress={() => setBudgetSheetOpen(true)}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="pencil-sharp" size={12} color={C.amber} />
                    <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>Customize Budget</Text>
                  </Pressable>
                </View>
                <Text style={{ color: C.text, fontSize: 38, fontWeight: '800', marginTop: 4 }}>
                  {inr(money.todayTotal)}
                </Text>

                {/* 3-Way Snapshot: Today / Week / Month */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: S.m }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: C.surface2,
                      borderRadius: R.m,
                      padding: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Label style={{ fontSize: 9.5 }}>Today</Label>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 3 }}>
                      {inr(money.todayTotal)}
                    </Text>
                    <Text
                      style={{
                        color: money.remainingDaily >= 0 ? C.green : C.red,
                        fontSize: 10.5,
                        fontWeight: '700',
                        marginTop: 2,
                      }}
                    >
                      {money.remainingDaily >= 0 ? `${inr(money.remainingDaily)} left` : `over`}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      backgroundColor: C.surface2,
                      borderRadius: R.m,
                      padding: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Label style={{ fontSize: 9.5 }}>This Week</Label>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 3 }}>
                      {inr(money.weekSpent)}
                    </Text>
                    <Text
                      style={{
                        color: money.remainingWeekly >= 0 ? C.green : C.red,
                        fontSize: 10.5,
                        fontWeight: '700',
                        marginTop: 2,
                      }}
                    >
                      {money.remainingWeekly >= 0 ? `${inr(money.remainingWeekly)} left` : `over`}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      backgroundColor: C.surface2,
                      borderRadius: R.m,
                      padding: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Label style={{ fontSize: 9.5 }}>This Month</Label>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 3 }}>
                      {inr(money.monthSpent)}
                    </Text>
                    <Text
                      style={{
                        color: money.remainingMonthly >= 0 ? C.green : C.red,
                        fontSize: 10.5,
                        fontWeight: '700',
                        marginTop: 2,
                      }}
                    >
                      {money.remainingMonthly >= 0 ? `${inr(money.remainingMonthly)} left` : `over`}
                    </Text>
                  </View>
                </View>

                {/* Status Callout */}
                <View
                  style={{
                    marginTop: S.m,
                    borderRadius: R.l,
                    backgroundColor: money.over > 0 ? alpha(C.red, 0.1) : alpha(C.green, 0.1),
                    borderWidth: 1,
                    borderColor: money.over > 0 ? alpha(C.red, 0.3) : alpha(C.green, 0.3),
                    padding: S.m,
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name={money.over > 0 ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color={money.over > 0 ? C.red : C.green}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
                    {money.over > 0
                      ? `Pacing is ${inr(money.over)} over weekly target. Projected weekly total: ${inr(money.projected)}.`
                      : `You're ${inr(Math.abs(money.over))} under weekly pace. Projected weekly total: ${inr(money.projected)}.`}
                  </Text>
                </View>
              </Card>
            </Animated.View>

            {/* 2. SPENDING INSIGHTS */}
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <Card style={{ marginTop: S.s, borderColor: alpha(C.amber, 0.35) }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <IconBadge icon="sparkles" color={C.amber} size={36} iconSize={17} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, lineHeight: 19, fontWeight: '600' }}>
                      {money.spendingInsight}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>
                      {money.typicalLine}
                    </Text>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* 3. LAST 7 DAYS CHART & BUDGET PROGRESS */}
            <Animated.View entering={FadeInDown.delay(180).springify()}>
              <Card style={{ marginTop: S.s }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.m }}>
                  <Label>Last 7 Days Spending</Label>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>
                    Week: {inr(money.weekSpent)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 92 }}>
                  {money.last7.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: d.isToday ? C.amber : C.faint, fontSize: 9.5, fontWeight: '700' }}>
                        {d.total > 0 ? inr(d.total) : ''}
                      </Text>
                      <View
                        style={{
                          width: '100%',
                          maxWidth: 26,
                          height: Math.max(5, (d.total / maxDay) * 56),
                          borderRadius: 7,
                          backgroundColor: d.isToday ? C.amber : C.surface3,
                        }}
                      />
                      <Text style={{ color: d.isToday ? C.amber : C.faint, fontSize: 10, fontWeight: '800' }}>
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Dual Budget View Selector (Weekly / Monthly) */}
                <View style={{ marginTop: S.l, backgroundColor: C.surface2, borderRadius: R.m, padding: S.m }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: C.surface3, borderRadius: R.pill, padding: 2 }}>
                      <Pressable
                        onPress={() => setBudgetViewMode('week')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: R.pill,
                          backgroundColor: budgetViewMode === 'week' ? C.amber : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: budgetViewMode === 'week' ? '#1A1206' : C.sub,
                            fontSize: 11,
                            fontWeight: '800',
                          }}
                        >
                          Weekly Budget
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setBudgetViewMode('month')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: R.pill,
                          backgroundColor: budgetViewMode === 'month' ? C.amber : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: budgetViewMode === 'month' ? '#1A1206' : C.sub,
                            fontSize: 11,
                            fontWeight: '800',
                          }}
                        >
                          Monthly Budget
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => setBudgetSheetOpen(true)}
                      hitSlop={6}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                    >
                      <Ionicons name="settings-outline" size={12} color={C.amber} />
                      <Text style={{ color: C.amber, fontSize: 11.5, fontWeight: '700' }}>Edit</Text>
                    </Pressable>
                  </View>

                  {budgetViewMode === 'week' ? (
                    <View>
                      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                        <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>Weekly Target</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>
                          {weekPct}% ({inr(money.weekSpent)} / {inr(state.weeklyBudget)})
                        </Text>
                      </View>
                      <Bar pct={weekPct} color={weekPct > 90 ? C.red : weekPct > 65 ? C.amber : C.green} />
                      <Text style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>
                        {money.remainingWeekly >= 0
                          ? `₹${money.remainingWeekly} remaining for this week`
                          : `₹${Math.abs(money.remainingWeekly)} over weekly limit`}
                      </Text>
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                        <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>Monthly Target</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>
                          {monthPct}% ({inr(money.monthSpent)} / {inr(monthlyBudget)})
                        </Text>
                      </View>
                      <Bar pct={monthPct} color={monthPct > 90 ? C.red : monthPct > 65 ? C.amber : C.green} />
                      <Text style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>
                        {money.remainingMonthly >= 0
                          ? `₹${money.remainingMonthly} remaining for this month`
                          : `₹${Math.abs(money.remainingMonthly)} over monthly limit`}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </Animated.View>

            {/* 4. CATEGORY BREAKDOWN (6 Categories) */}
            <Animated.View entering={FadeInDown.delay(240).springify()}>
              <Card style={{ marginTop: S.s }}>
                <Label style={{ marginBottom: S.m }}>Today by Category</Label>
                {money.byCat.length === 0 ? (
                  <Text style={{ color: C.faint, fontSize: 13 }}>No category spending logged yet today.</Text>
                ) : (
                  money.byCat.map((c, i) => {
                    const meta = CAT_META[c.cat] || CAT_META.other;
                    return (
                      <View key={c.cat} style={{ marginBottom: i === money.byCat.length - 1 ? 0 : S.m }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <Ionicons name={meta.icon as any} size={14} color={meta.color} />
                          <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>
                            {meta.label}
                          </Text>
                          <Text style={{ color: C.faint, fontSize: 11.5 }}>
                            ({c.pct}%)
                          </Text>
                          <View style={{ flex: 1 }} />
                          <Text style={{ color: C.sub, fontSize: 13, fontWeight: '800' }}>
                            {inr(c.total)}
                          </Text>
                        </View>
                        <Bar pct={(c.total / maxCat) * 100} color={meta.color} height={6} />
                      </View>
                    );
                  })
                )}
              </Card>
            </Animated.View>

            {/* Filter Selector for Transaction List */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.xl, marginBottom: S.m }}>
              <SectionHeader title="Transactions" icon="list-outline" />
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 4, backgroundColor: C.surface2, borderRadius: R.pill, padding: 3 }}>
                {(['today', 'week', 'all'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setViewFilter(f)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: R.pill,
                      backgroundColor: viewFilter === f ? C.amber : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: viewFilter === f ? '#1A1206' : C.faint,
                        fontSize: 11,
                        fontWeight: '800',
                        textTransform: 'capitalize',
                      }}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title="No spends found"
            sub="Tap + Log spend to add an expense in 5 seconds."
            actionText="+ Log Spend"
            onAction={openExpense}
          />
        }
        renderItem={({ item, index }) => {
          const meta = CAT_META[item.category] || CAT_META.other;
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 35, 300)).springify()}>
              <Card style={{ marginBottom: S.s, paddingVertical: S.m }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.m }}>
                  <IconBadge icon={meta.icon as any} color={meta.color} size={36} iconSize={16} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{item.note}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                      {meta.label} · {fmtDateShort(item.ts)}, {fmtClock(item.ts)}
                    </Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>
                    -{inr(item.amount)}
                  </Text>
                  <Pressable onPress={() => deleteExpense(item.id)} hitSlop={8} style={{ paddingLeft: 4 }}>
                    <Ionicons name="trash-outline" size={15} color={C.faint} />
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          );
        }}
      />

      {/* FAB: Log spend */}
      <Pressable
        onPress={openExpense}
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
        <Ionicons name="add" size={18} color="#1A1206" />
        <Text style={{ color: '#1A1206', fontWeight: '800', fontSize: 14 }}>Log spend</Text>
      </Pressable>

      {/* Budget Customization Modal */}
      <BudgetSheet visible={budgetSheetOpen} onClose={() => setBudgetSheetOpen(false)} />
    </SafeAreaView>
  );
}
