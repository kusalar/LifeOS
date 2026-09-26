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
import { CAT_META } from '../lib/engine';
import { useStore } from '../lib/store';
import type { ExpenseCategory } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn } from './ui';

const CATEGORIES: ExpenseCategory[] = ['food', 'travel', 'shopping', 'education', 'technology', 'other'];

export function ExpenseSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addExpense } = useStore();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<ExpenseCategory>('food');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
      setCat('food');
      setNote('');
      setError('');
    }
  }, [visible]);

  const save = () => {
    const cleanAmount = amount.replace(/[^\d]/g, '');
    const num = parseInt(cleanAmount, 10);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    const defaultNote = CAT_META[cat]?.label || 'Expense';
    addExpense(num, cat, note.trim() || defaultNote);
    onClose();
  };

  const getPlaceholderNote = (category: ExpenseCategory) => {
    switch (category) {
      case 'food':
        return 'e.g. Lunch at mess, Chai with friends';
      case 'travel':
        return 'e.g. Metro card, Auto fare, Bus ticket';
      case 'shopping':
        return 'e.g. Notebooks, Groceries, Shampoo';
      case 'education':
        return 'e.g. Assignment printout, Course fee';
      case 'technology':
        return 'e.g. Cloud storage, Earphones, Cable';
      case 'other':
      default:
        return 'e.g. Laundry, haircut, miscellaneous';
    }
  };

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
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.m }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: alpha(C.amber, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="wallet" size={20} color={C.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>Add Expense</Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>Instant update to daily & weekly budget</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close add expense sheet"
            >
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Amount input */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              AMOUNT
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: error ? alpha(C.red, 0.6) : C.border2,
                paddingHorizontal: 16,
                marginBottom: error ? 4 : S.m,
              }}
            >
              <Text style={{ color: C.amber, fontSize: 24, fontWeight: '800', marginRight: 6 }}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => {
                  setAmount(t.replace(/[^\d]/g, ''));
                  if (error) setError('');
                }}
                placeholder="0"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
                autoFocus
                style={{
                  flex: 1,
                  color: C.text,
                  fontSize: 26,
                  fontWeight: '800',
                  paddingVertical: 12,
                }}
              />
            </View>
            {error ? (
              <Text style={{ color: C.red, fontSize: 12, fontWeight: '600', marginBottom: S.m }}>{error}</Text>
            ) : null}

            {/* Category selection */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              CATEGORY
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.l }}>
              {CATEGORIES.map((c) => {
                const meta = CAT_META[c];
                const active = cat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCat(c)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: R.pill,
                      backgroundColor: active ? alpha(meta.color, 0.18) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? alpha(meta.color, 0.6) : C.border,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                    }}
                  >
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={15}
                      color={active ? meta.color : C.sub}
                    />
                    <Text
                      style={{
                        color: active ? meta.color : C.sub,
                        fontSize: 13,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional Note */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              NOTE (OPTIONAL)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={getPlaceholderNote(cat)}
              placeholderTextColor={C.faint}
              returnKeyType="done"
              onSubmitEditing={save}
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: C.border2,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: C.text,
                fontSize: 14,
                marginBottom: S.xl,
              }}
            />

            <Btn title="Save Expense" icon="checkmark" onPress={save} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
