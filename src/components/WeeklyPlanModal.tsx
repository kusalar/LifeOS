import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { alpha, C, R, S } from '../theme';
import { WeeklyPlanView } from './WeeklyPlanView';

export function WeeklyPlanModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(3,6,12,0.80)', justifyContent: 'flex-end' }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close weekly planning sheet"
        />
        <Animated.View
          entering={FadeInUp.springify()}
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: R.xxl,
            borderTopRightRadius: R.xxl,
            borderWidth: 1,
            borderColor: alpha(C.teal, 0.4),
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
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: alpha(C.teal, 0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={20} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>Weekly Review & Plan</Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>
                Last week execution vs. realistic capacity
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close weekly planning"
            >
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <WeeklyPlanView />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
