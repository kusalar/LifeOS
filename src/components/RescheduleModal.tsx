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
import { fmtTime } from '../lib/dates';
import { useStore } from '../lib/store';
import { alpha, C, R, S } from '../theme';
import type { AdaptiveProposal } from '../types';
import { Btn, Card, Chip, PriorityBadge } from './ui';

export function RescheduleModal({
  visible,
  onClose,
  proposal,
}: {
  visible: boolean;
  onClose: () => void;
  proposal?: AdaptiveProposal | null;
}) {
  const { state, applyRescheduleProposal, rejectRescheduleProposal, dismissRescheduleProposal } = useStore();

  const proposals = proposal
    ? [proposal]
    : (state?.adaptiveProposals ?? []).filter((p) => p.status === 'pending');

  if (!visible) return null;

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
            maxHeight: '85%',
            paddingBottom: 28,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          <ScrollView style={{ paddingHorizontal: S.l }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.m }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: alpha(C.amber, 0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="calendar-outline" size={22} color={C.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>Adaptive Rescheduling</Text>
                <Text style={{ color: C.faint, fontSize: 12 }}>
                  {proposals.length > 0
                    ? `${proposals.length} proposed schedule adjustment${proposals.length > 1 ? 's' : ''}`
                    : 'No pending schedule adjustments'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.sub} />
              </Pressable>
            </View>

            {proposals.length === 0 ? (
              <Card style={{ padding: S.l, alignItems: 'center', marginTop: S.m }}>
                <Ionicons name="checkmark-circle-outline" size={32} color={C.green} />
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', marginTop: 10 }}>
                  Schedule Aligned
                </Text>
                <Text style={{ color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                  No active overruns or collisions detected. Your day is on track.
                </Text>
                <Btn style={{ marginTop: S.m }} onPress={onClose}>
                  Done
                </Btn>
              </Card>
            ) : (
              proposals.map((prop) => {
                const oldStartStr = prop.oldStart !== undefined ? fmtTime(prop.oldStart) : 'Unscheduled';
                const oldEndStr = prop.oldEnd !== undefined ? fmtTime(prop.oldEnd) : '';
                const newStartStr = fmtTime(prop.newStart);
                const newEndStr = fmtTime(prop.newEnd);

                return (
                  <Card
                    key={prop.id}
                    style={{
                      marginBottom: S.m,
                      backgroundColor: C.surface2,
                      borderColor: alpha(C.amber, 0.3),
                      padding: S.l,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: C.amber, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                        MOVE TASK / BLOCK
                      </Text>
                      <PriorityBadge priority={prop.priority} />
                    </View>

                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 12 }}>
                      {prop.taskTitle}
                    </Text>

                    {/* Old vs New Time */}
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: C.surface3,
                        borderRadius: R.m,
                        padding: 12,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>CURRENT</Text>
                        <Text style={{ color: C.sub, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                          {oldStartStr}{oldEndStr ? `–${oldEndStr}` : ''}
                        </Text>
                      </View>

                      <Ionicons name="arrow-forward" size={18} color={C.amber} style={{ marginHorizontal: 8 }} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.amber, fontSize: 11, fontWeight: '800' }}>SUGGESTED</Text>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                          {newStartStr}–{newEndStr}
                        </Text>
                      </View>
                    </View>

                    {/* Reason */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>REASON</Text>
                      <Text style={{ color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {prop.reason}
                      </Text>
                    </View>

                    {/* Impact */}
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>IMPACT</Text>
                      <Text style={{ color: C.text, fontSize: 13, lineHeight: 18, marginTop: 2, fontWeight: '600' }}>
                        {prop.impact}
                      </Text>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <View style={{ flex: 1 }}>
                        <Btn
                          variant="primary"
                          icon="checkmark"
                          onPress={() => {
                            applyRescheduleProposal(prop.id);
                            if (proposals.length <= 1) onClose();
                          }}
                        >
                          Accept
                        </Btn>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Btn
                          variant="secondary"
                          icon="pause-outline"
                          onPress={() => {
                            rejectRescheduleProposal(prop.id);
                            if (proposals.length <= 1) onClose();
                          }}
                        >
                          Keep Original
                        </Btn>
                      </View>
                      <Pressable
                        onPress={() => {
                          dismissRescheduleProposal(prop.id);
                          if (proposals.length <= 1) onClose();
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: R.m,
                          backgroundColor: C.surface3,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: C.border,
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={20} color={C.faint} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
