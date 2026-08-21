import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useStore } from '../lib/store';
import { alpha, C, inr, R, S } from '../theme';
import { Btn, Label } from './ui';

interface BudgetSheetProps {
  visible: boolean;
  onClose: () => void;
}

type BudgetMode = 'weekly' | 'monthly' | 'custom';

const WEEKLY_PRESETS = [1500, 2500, 3500, 5000, 7500];
const MONTHLY_PRESETS = [6000, 10000, 15000, 22000, 30000];

export function BudgetSheet({ visible, onClose }: BudgetSheetProps) {
  const { state, updateBudget } = useStore();
  const [mode, setMode] = useState<BudgetMode>('weekly');

  const [weeklyInput, setWeeklyInput] = useState('2800');
  const [monthlyInput, setMonthlyInput] = useState('12000');
  const [dailyInput, setDailyInput] = useState('400');
  const [autoSync, setAutoSync] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && state) {
      const wk = state.weeklyBudget || 2800;
      const mo = state.monthlyBudget || Math.round(wk * (30 / 7));
      const dy = state.dailyBudget || Math.round(wk / 7);

      setWeeklyInput(String(wk));
      setMonthlyInput(String(mo));
      setDailyInput(String(dy));
      setError('');
    }
  }, [visible, state]);

  const handleWeeklyChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    setWeeklyInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0 && autoSync) {
      setDailyInput(String(Math.round(num / 7)));
      setMonthlyInput(String(Math.round(num * (30 / 7))));
    }
  };

  const handleMonthlyChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    setMonthlyInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0 && autoSync) {
      setWeeklyInput(String(Math.round(num * (7 / 30))));
      setDailyInput(String(Math.round(num / 30)));
    }
  };

  const handleDailyChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    setDailyInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0 && autoSync) {
      setWeeklyInput(String(Math.round(num * 7)));
      setMonthlyInput(String(Math.round(num * 30)));
    }
  };

  const handleApplyPreset = (amount: number, type: 'weekly' | 'monthly') => {
    if (type === 'weekly') {
      setWeeklyInput(String(amount));
      setDailyInput(String(Math.round(amount / 7)));
      setMonthlyInput(String(Math.round(amount * (30 / 7))));
    } else {
      setMonthlyInput(String(amount));
      setWeeklyInput(String(Math.round(amount * (7 / 30))));
      setDailyInput(String(Math.round(amount / 30)));
    }
  };

  const handleSave = () => {
    const w = parseInt(weeklyInput, 10);
    const m = parseInt(monthlyInput, 10);
    const d = parseInt(dailyInput, 10);

    if (isNaN(w) || w <= 0) {
      setError('Please enter a valid weekly budget (greater than 0).');
      return;
    }
    if (isNaN(m) || m <= 0) {
      setError('Please enter a valid monthly budget (greater than 0).');
      return;
    }
    if (isNaN(d) || d <= 0) {
      setError('Please enter a valid daily budget (greater than 0).');
      return;
    }

    updateBudget({
      weeklyBudget: w,
      monthlyBudget: m,
      dailyBudget: d,
    });
    onClose();
  };

  const parsedWeekly = parseInt(weeklyInput, 10) || 0;
  const parsedMonthly = parseInt(monthlyInput, 10) || 0;
  const parsedDaily = parseInt(dailyInput, 10) || 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(3,6,12,0.76)', justifyContent: 'flex-end' }}
      >
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <Animated.View
          entering={FadeInUp.springify()}
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: R.xxl,
            borderTopRightRadius: R.xxl,
            borderWidth: 1,
            borderColor: C.border2,
            padding: S.l,
            paddingBottom: Platform.OS === 'ios' ? 36 : 28,
            maxHeight: '90%',
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.m }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>Customize Budget</Text>
              <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                Set weekly and monthly targets to calibrate pacing and AI insights.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: C.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={18} color={C.faint} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mode Switcher */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: C.surface2,
                borderRadius: R.pill,
                padding: 3,
                marginBottom: S.m,
              }}
            >
              {(
                [
                  { key: 'weekly', label: 'Weekly Target' },
                  { key: 'monthly', label: 'Monthly Target' },
                  { key: 'custom', label: 'All Targets' },
                ] as const
              ).map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setMode(t.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: R.pill,
                    alignItems: 'center',
                    backgroundColor: mode === t.key ? C.amber : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: mode === t.key ? '#1A1206' : C.sub,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Main Input Depending on Mode */}
            {mode === 'weekly' && (
              <View style={{ marginBottom: S.m }}>
                <Label style={{ marginBottom: 6 }}>Weekly Budget (₹)</Label>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: C.surface2,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: R.l,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: C.amber, fontSize: 24, fontWeight: '800', marginRight: 4 }}>₹</Text>
                  <TextInput
                    value={weeklyInput}
                    onChangeText={handleWeeklyChange}
                    keyboardType="number-pad"
                    placeholder="2800"
                    placeholderTextColor={C.faint}
                    style={{
                      flex: 1,
                      color: C.text,
                      fontSize: 24,
                      fontWeight: '800',
                      padding: 0,
                    }}
                  />
                  <Text style={{ color: C.faint, fontSize: 13, fontWeight: '600' }}>/ week</Text>
                </View>

                {/* Quick Presets */}
                <View style={{ marginTop: 10 }}>
                  <Label style={{ fontSize: 10.5, marginBottom: 6 }}>Quick Weekly Presets</Label>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {WEEKLY_PRESETS.map((amt) => {
                      const isSelected = parsedWeekly === amt;
                      return (
                        <Pressable
                          key={amt}
                          onPress={() => handleApplyPreset(amt, 'weekly')}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: R.pill,
                            backgroundColor: isSelected ? alpha(C.amber, 0.2) : C.surface2,
                            borderWidth: 1,
                            borderColor: isSelected ? C.amber : C.border,
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? C.amber : C.sub,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {inr(amt)}/wk
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {mode === 'monthly' && (
              <View style={{ marginBottom: S.m }}>
                <Label style={{ marginBottom: 6 }}>Monthly Budget (₹)</Label>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: C.surface2,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: R.l,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: C.amber, fontSize: 24, fontWeight: '800', marginRight: 4 }}>₹</Text>
                  <TextInput
                    value={monthlyInput}
                    onChangeText={handleMonthlyChange}
                    keyboardType="number-pad"
                    placeholder="12000"
                    placeholderTextColor={C.faint}
                    style={{
                      flex: 1,
                      color: C.text,
                      fontSize: 24,
                      fontWeight: '800',
                      padding: 0,
                    }}
                  />
                  <Text style={{ color: C.faint, fontSize: 13, fontWeight: '600' }}>/ month</Text>
                </View>

                {/* Quick Presets */}
                <View style={{ marginTop: 10 }}>
                  <Label style={{ fontSize: 10.5, marginBottom: 6 }}>Quick Monthly Presets</Label>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {MONTHLY_PRESETS.map((amt) => {
                      const isSelected = parsedMonthly === amt;
                      return (
                        <Pressable
                          key={amt}
                          onPress={() => handleApplyPreset(amt, 'monthly')}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: R.pill,
                            backgroundColor: isSelected ? alpha(C.amber, 0.2) : C.surface2,
                            borderWidth: 1,
                            borderColor: isSelected ? C.amber : C.border,
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? C.amber : C.sub,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {inr(amt)}/mo
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {mode === 'custom' && (
              <View style={{ gap: S.m, marginBottom: S.m }}>
                {/* Auto Sync Toggle */}
                <Pressable
                  onPress={() => setAutoSync(!autoSync)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: C.surface2,
                    borderRadius: R.m,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={autoSync ? 'sync-circle' : 'sync-circle-outline'}
                      size={18}
                      color={autoSync ? C.amber : C.faint}
                    />
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700' }}>
                      Auto-proportion targets
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 38,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: autoSync ? C.amber : C.surface3,
                      padding: 2,
                      alignItems: autoSync ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#1A1206' }} />
                  </View>
                </Pressable>

                {/* Daily */}
                <View>
                  <Label style={{ marginBottom: 5 }}>Daily Target (₹)</Label>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: C.surface2,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: R.m,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: C.amber, fontSize: 18, fontWeight: '800', marginRight: 4 }}>₹</Text>
                    <TextInput
                      value={dailyInput}
                      onChangeText={handleDailyChange}
                      keyboardType="number-pad"
                      placeholder="400"
                      placeholderTextColor={C.faint}
                      style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '700', padding: 0 }}
                    />
                    <Text style={{ color: C.faint, fontSize: 11.5 }}>/ day</Text>
                  </View>
                </View>

                {/* Weekly */}
                <View>
                  <Label style={{ marginBottom: 5 }}>Weekly Target (₹)</Label>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: C.surface2,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: R.m,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: C.amber, fontSize: 18, fontWeight: '800', marginRight: 4 }}>₹</Text>
                    <TextInput
                      value={weeklyInput}
                      onChangeText={handleWeeklyChange}
                      keyboardType="number-pad"
                      placeholder="2800"
                      placeholderTextColor={C.faint}
                      style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '700', padding: 0 }}
                    />
                    <Text style={{ color: C.faint, fontSize: 11.5 }}>/ week</Text>
                  </View>
                </View>

                {/* Monthly */}
                <View>
                  <Label style={{ marginBottom: 5 }}>Monthly Target (₹)</Label>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: C.surface2,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: R.m,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: C.amber, fontSize: 18, fontWeight: '800', marginRight: 4 }}>₹</Text>
                    <TextInput
                      value={monthlyInput}
                      onChangeText={handleMonthlyChange}
                      keyboardType="number-pad"
                      placeholder="12000"
                      placeholderTextColor={C.faint}
                      style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '700', padding: 0 }}
                    />
                    <Text style={{ color: C.faint, fontSize: 11.5 }}>/ month</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Breakdown Snapshot Card */}
            <View
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: C.border2,
                padding: S.m,
                marginTop: S.s,
                marginBottom: S.m,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="sparkles-outline" size={14} color={C.amber} />
                <Label style={{ color: C.amber, fontSize: 10.5 }}>Calculated Target Matrix</Label>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: C.surface3,
                    borderRadius: R.m,
                    padding: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: C.faint, fontSize: 9.5, fontWeight: '700' }}>Daily</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                    {inr(parsedDaily)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: alpha(C.amber, 0.12),
                    borderColor: alpha(C.amber, 0.3),
                    borderWidth: 1,
                    borderRadius: R.m,
                    padding: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: C.amber, fontSize: 9.5, fontWeight: '700' }}>Weekly</Text>
                  <Text style={{ color: C.amber, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                    {inr(parsedWeekly)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: C.surface3,
                    borderRadius: R.m,
                    padding: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: C.faint, fontSize: 9.5, fontWeight: '700' }}>Monthly</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                    {inr(parsedMonthly)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Error message */}
            {error ? (
              <Text style={{ color: C.red, fontSize: 12, marginBottom: S.m, fontWeight: '600' }}>
                {error}
              </Text>
            ) : null}

            {/* Save Button */}
            <Btn title="Save Budget Targets" icon="checkmark" onPress={handleSave} variant="primary" />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
