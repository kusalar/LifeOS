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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useStore } from '../lib/store';
import { askLifeOS } from '../lib/engine';
import type { AskReply, ProposedTask } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn } from './ui';

const SUGGESTIONS = [
  'I have an exam next Thursday. I need to finish chapters 4–8, and my VLSI report is due Tuesday.',
  'I have ₹500 and need lunch, transport and a notebook',
  'I have 2 hours free, what should I do?',
  'What should I do right now?',
];

export function AskSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, addProposedTasks } = useStore();
  const [q, setQ] = useState('');
  const [thinking, setThinking] = useState(false);
  const [reply, setReply] = useState<AskReply | null>(null);
  const [selectedPlanTasks, setSelectedPlanTasks] = useState<Record<number, boolean>>({});
  const [planConfirmed, setPlanConfirmed] = useState(false);

  useEffect(() => {
    if (visible) {
      setReply(null);
      setThinking(false);
      setSelectedPlanTasks({});
      setPlanConfirmed(false);
    }
  }, [visible]);

  const send = (text?: string) => {
    const query = (text ?? q).trim();
    if (!query || thinking || !state) return;
    setQ(query);
    setThinking(true);
    setReply(null);
    setPlanConfirmed(false);
    setTimeout(() => {
      const rep = askLifeOS(query, state);
      setReply(rep);
      if (rep.proposedTasks) {
        const initialSelected: Record<number, boolean> = {};
        rep.proposedTasks.forEach((_, idx) => {
          initialSelected[idx] = true;
        });
        setSelectedPlanTasks(initialSelected);
      }
      setThinking(false);
    }, 850);
  };

  const handleAddPlan = () => {
    if (!reply?.proposedTasks) return;
    const toAdd = reply.proposedTasks
      .filter((_, idx) => selectedPlanTasks[idx])
      .map((t) => ({
        title: t.title,
        priority: t.priority,
        dueTs: t.dueTs || Date.now() + 86400000,
        tag: 'General',
        projectId: t.projectId,
        estimatedMinutes: t.estimatedMinutes,
        taskType: t.taskType,
      }));
    if (toAdd.length > 0) {
      addProposedTasks(toAdd);
      setPlanConfirmed(true);
    }
  };

  const toneColor = (t?: string) => (t === 'good' ? C.green : t === 'bad' ? C.red : t === 'accent' ? C.amber : C.text);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(3,6,12,0.72)', justifyContent: 'flex-end' }}
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
            paddingBottom: 24,
            maxHeight: '86%',
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          <ScrollView style={{ paddingHorizontal: S.l }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.l }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: alpha(C.violet, 0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="sparkles" size={20} color={C.violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 17 }}>Ask LifeOS</Text>
                <Text style={{ color: C.faint, fontSize: 12 }}>Decision engine · not another chatbot</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.sub} />
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: C.border2,
                paddingLeft: 14,
                paddingRight: 6,
                paddingVertical: 4,
              }}
            >
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder='Try "I have ₹500 and need lunch, transport and a notebook"'
                placeholderTextColor={C.faint}
                style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 8, maxHeight: 80 }}
                multiline
                returnKeyType="send"
                onSubmitEditing={() => send()}
              />
              <Pressable
                onPress={() => send()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: C.violet,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-up" size={18} color="#150F24" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: S.m }}>
              {SUGGESTIONS.map((sug) => (
                <Pressable
                  key={sug}
                  onPress={() => send(sug)}
                  style={({ pressed }) => ({
                    borderRadius: R.pill,
                    backgroundColor: C.surface2,
                    borderWidth: 1,
                    borderColor: C.border,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: C.sub, fontSize: 12, fontWeight: '600' }}>{sug}</Text>
                </Pressable>
              ))}
            </View>

            {thinking ? (
              <View style={{ alignItems: 'center', paddingVertical: 34, gap: 10 }}>
                <Ionicons name="sparkles-outline" size={26} color={C.violet} />
                <Text style={{ color: C.sub, fontSize: 13 }}>Weighing your schedule, deadlines and budget…</Text>
              </View>
            ) : null}

            {reply ? (
              <Animated.View entering={FadeInDown.springify()} style={{ marginTop: S.l }}>
                <View
                  style={{
                    backgroundColor: C.surface2,
                    borderRadius: R.xl,
                    borderWidth: 1,
                    borderColor: alpha(C.violet, 0.3),
                    padding: S.l,
                  }}
                >
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, marginBottom: S.m }}>{reply.title}</Text>
                  {reply.lines.map((line, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: 12,
                        paddingVertical: 7,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: C.border,
                      }}
                    >
                      <Text style={{ color: C.sub, fontSize: 13.5, flex: 1, fontWeight: '600' }}>{line.label}</Text>
                      <Text style={{ color: toneColor(line.tone), fontSize: 13.5, fontWeight: '800' }}>{line.value}</Text>
                    </View>
                  ))}
                  <View
                    style={{
                      marginTop: S.m,
                      borderRadius: R.l,
                      backgroundColor: alpha(reply.tone === 'bad' ? C.red : C.green, 0.1),
                      borderWidth: 1,
                      borderColor: alpha(reply.tone === 'bad' ? C.red : C.green, 0.25),
                      padding: S.m,
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name={reply.tone === 'bad' ? 'warning-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={reply.tone === 'bad' ? C.red : C.green}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 18, flex: 1 }}>{reply.verdict}</Text>
                  </View>

                  {/* Proposed Tasks for NL Planning */}
                  {reply.proposedTasks && reply.proposedTasks.length > 0 ? (
                    <View style={{ marginTop: S.m, paddingTop: S.m, borderTopWidth: 1, borderTopColor: C.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: C.amber, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                          PROPOSED CHANGES
                        </Text>
                        <Text style={{ color: C.faint, fontSize: 11 }}>
                          Nothing added yet
                        </Text>
                      </View>

                      {planConfirmed ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={18} color={C.green} />
                          <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>
                            Tasks successfully added to your plan!
                          </Text>
                        </View>
                      ) : (
                        <>
                          {reply.proposedTasks.map((t, idx) => {
                            const selected = !!selectedPlanTasks[idx];
                            return (
                              <Pressable
                                key={idx}
                                onPress={() =>
                                  setSelectedPlanTasks((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 10,
                                  paddingVertical: 8,
                                  borderBottomWidth: 1,
                                  borderBottomColor: alpha(C.border, 0.5),
                                }}
                              >
                                <Ionicons
                                  name={selected ? 'checkbox' : 'square-outline'}
                                  size={18}
                                  color={selected ? C.amber : C.faint}
                                />
                                <Text
                                  style={{
                                    color: selected ? C.text : C.sub,
                                    fontSize: 13,
                                    flex: 1,
                                    fontWeight: selected ? '600' : '400',
                                  }}
                                >
                                  {t.title}
                                </Text>
                                {t.estimatedMinutes ? (
                                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600' }}>
                                    {t.estimatedMinutes}m
                                  </Text>
                                ) : null}
                              </Pressable>
                            );
                          })}

                          <View style={{ marginTop: S.m }}>
                            {Object.values(selectedPlanTasks).filter(Boolean).length > 0 ? (
                              <Btn
                                title={`Add Plan (${Object.values(selectedPlanTasks).filter(Boolean).length})`}
                                icon="add"
                                onPress={handleAddPlan}
                              />
                            ) : null}
                          </View>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            {!reply && !thinking ? (
              <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: S.l, lineHeight: 18 }}>
                LifeOS combines your schedule, tasks, deadlines and money{'\n'}to recommend the next right thing.
              </Text>
            ) : null}
            <View style={{ height: 10 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
