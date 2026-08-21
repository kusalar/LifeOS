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
import { parseNLDateTime } from '../lib/dates';
import { useStore } from '../lib/store';
import type { Priority } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn } from './ui';

const NL_EXAMPLES = [
  'Electricity bill by tomorrow 8pm',
  'Dentist appointment Friday 4pm',
  'Return library book in 3 days',
  'Cancel subscription on Sunday 10am',
];

export function ReminderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addReminder } = useStore();
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<Priority>('important');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setInput('');
      setPriority('important');
      setError('');
    }
  }, [visible]);

  const parsed = input.trim() ? parseNLDateTime(input) : null;

  const save = () => {
    if (!input.trim()) {
      setError('Please enter a reminder');
      return;
    }

    const { title, dueTs } = parseNLDateTime(input);
    addReminder(title, dueTs, 'Direct Reminder', priority);
    onClose();
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
            maxHeight: '88%',
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
                backgroundColor: alpha(C.teal, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications" size={20} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>Add Reminder</Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>Type naturally — date & time detected automatically</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              WHAT SHOULD LIFEOS REMEMBER?
            </Text>
            <TextInput
              value={input}
              onChangeText={(t) => {
                setInput(t);
                if (error) setError('');
              }}
              placeholder="e.g. Return Amazon package tomorrow at 6pm"
              placeholderTextColor={C.faint}
              autoFocus
              multiline
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: error ? alpha(C.red, 0.6) : C.border2,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: C.text,
                fontSize: 15,
                lineHeight: 21,
                minHeight: 65,
                textAlignVertical: 'top',
                marginBottom: error ? 4 : S.s,
              }}
            />
            {error ? (
              <Text style={{ color: C.red, fontSize: 12, fontWeight: '600', marginBottom: S.s }}>{error}</Text>
            ) : null}

            {/* Live NLP Preview */}
            {parsed ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: alpha(C.teal, 0.12),
                  borderRadius: R.m,
                  borderWidth: 1,
                  borderColor: alpha(C.teal, 0.3),
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: S.m,
                }}
              >
                <Ionicons name="time-outline" size={16} color={C.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.teal, fontSize: 12.5, fontWeight: '800' }}>
                    Title: "{parsed.title}"
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 11.5 }}>
                    Due: {parsed.detectedDateStr}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Example chips */}
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 }}>
              QUICK EXAMPLES
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.l }}>
              {NL_EXAMPLES.map((ex, i) => (
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
                    {ex}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Btn title="Save Reminder" icon="checkmark" onPress={save} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
