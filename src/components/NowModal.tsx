import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getWhatToDoNow } from '../lib/engine';
import { useStore } from '../lib/store';
import { alpha, C, R, S } from '../theme';
import { Btn, IconBadge, PriorityBadge } from './ui';

export function NowModal({
  visible,
  onClose,
  onNavigatePlan,
  onNavigateTasks,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigatePlan?: () => void;
  onNavigateTasks?: () => void;
}) {
  const { state, toggleTask, toggleBlock, startTask, stopActiveTask } = useStore();

  const rec = useMemo(() => (state ? getWhatToDoNow(state) : null), [state, visible]);

  if (!state || !rec) return null;

  const isTask = !!rec.taskId;
  const isBlock = !!rec.blockId;
  const isStarted = !!rec.isStarted;

  const handleStart = () => {
    if (rec.taskId) {
      startTask(rec.taskId);
    }
  };

  const handleStop = () => {
    stopActiveTask();
  };

  const handleComplete = () => {
    if (rec.taskId) {
      toggleTask(rec.taskId);
      onClose();
    } else if (rec.blockId) {
      toggleBlock(rec.blockId);
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,6,12,0.80)', justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <Animated.View
          entering={FadeInUp.springify()}
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: R.xxl,
            borderTopRightRadius: R.xxl,
            borderWidth: 1,
            borderColor: alpha(C.violet, 0.4),
            padding: S.l,
            paddingBottom: Platform.OS === 'ios' ? 36 : 28,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.l }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: alpha(C.violet, 0.16),
                borderWidth: 1,
                borderColor: alpha(C.violet, 0.4),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={22} color={C.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>What Should I Do Now?</Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>Evaluated against deadlines, projects & schedule</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Primary Recommendation Card */}
            <View
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.xl,
                borderWidth: 1.5,
                borderColor: alpha(rec.tagColor, 0.45),
                padding: S.l,
                marginBottom: S.m,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.s, flexWrap: 'wrap' }}>
                <View
                  style={{
                    borderRadius: R.pill,
                    backgroundColor: alpha(rec.tagColor, 0.16),
                    borderWidth: 1,
                    borderColor: alpha(rec.tagColor, 0.4),
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: rec.tagColor, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    {rec.category.toUpperCase()}
                  </Text>
                </View>

                {rec.projectName ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: R.pill,
                      backgroundColor: alpha(C.blue, 0.16),
                      borderWidth: 1,
                      borderColor: alpha(C.blue, 0.35),
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Ionicons name="folder-outline" size={12} color={C.blue} />
                    <Text style={{ color: C.blue, fontSize: 11, fontWeight: '700' }}>
                      {rec.projectName}
                    </Text>
                  </View>
                ) : null}

                {isStarted ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: R.pill,
                      backgroundColor: alpha(C.green, 0.18),
                      borderWidth: 1,
                      borderColor: alpha(C.green, 0.4),
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Ionicons name="play" size={11} color={C.green} />
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '800' }}>
                      IN PROGRESS
                    </Text>
                  </View>
                ) : null}

                <View style={{ flex: 1 }} />
                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700' }}>
                  Confidence: {rec.confidence}
                </Text>
              </View>

              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginVertical: 4 }}>
                {rec.actionTitle}
              </Text>

              {/* Structured Explanation Lines */}
              {rec.explanationLines && rec.explanationLines.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                  {rec.explanationLines.map((line, idx) => (
                    <View
                      key={idx}
                      style={{
                        borderRadius: R.pill,
                        backgroundColor: alpha(C.text, 0.06),
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ color: C.sub, fontSize: 11.5, fontWeight: '600' }}>
                        • {line}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={{ color: C.sub, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>
                {rec.reason}
              </Text>

              {rec.secondaryAction ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: S.m,
                    paddingTop: S.m,
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                  }}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={16} color={C.amber} />
                  <Text style={{ color: C.amber, fontSize: 12.5, fontWeight: '700', flex: 1 }}>
                    {rec.secondaryAction}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Quick action buttons */}
            <View style={{ gap: 8, marginTop: 4 }}>
              {isTask && !isStarted ? (
                <Btn
                  title="Start Focused Session"
                  icon="play"
                  variant="primary"
                  onPress={handleStart}
                />
              ) : null}

              {isTask && isStarted ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn
                    title="Mark Complete"
                    icon="checkmark-circle"
                    variant="primary"
                    onPress={handleComplete}
                    style={{ flex: 2 }}
                  />
                  <Btn
                    title="Pause"
                    icon="pause"
                    variant="ghost"
                    onPress={handleStop}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : isTask ? (
                <Btn
                  title="Mark Task Complete"
                  icon="checkmark-circle-outline"
                  variant="ghost"
                  onPress={handleComplete}
                />
              ) : isBlock ? (
                <Btn
                  title="Mark Schedule Block Done"
                  icon="checkmark-circle-outline"
                  variant="primary"
                  onPress={handleComplete}
                />
              ) : null}

              <Btn
                title="Got it"
                variant="ghost"
                onPress={onClose}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
