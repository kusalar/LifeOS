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
import { breakDownTask } from '../lib/engine';
import { useStore } from '../lib/store';
import { alpha, C, R, S } from '../theme';
import type { Priority, ProposedTask } from '../types';
import { Btn, Card, CheckCircle, Chip } from './ui';

export function BreakdownModal({
  visible,
  onClose,
  initialInput = '',
  projectId,
  defaultPriority = 'important',
}: {
  visible: boolean;
  onClose: () => void;
  initialInput?: string;
  projectId?: string;
  defaultPriority?: Priority;
}) {
  const { addProposedTasks } = useStore();
  const [input, setInput] = useState(initialInput);
  const [items, setItems] = useState<ProposedTask[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      const query = initialInput || 'Finish VLSI project';
      setInput(query);
      const generated = breakDownTask(query, { projectId, defaultPriority });
      setItems(generated);
      setError('');
    }
  }, [visible, initialInput, projectId, defaultPriority]);

  const handleRegenerate = (text: string) => {
    setInput(text);
    if (!text.trim()) {
      setItems([]);
      return;
    }
    const generated = breakDownTask(text, { projectId, defaultPriority });
    setItems(generated);
  };

  const toggleSelect = (id: string) => {
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateTitle = (id: string, newTitle: string) => {
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const updateDuration = (id: string, mins: number) => {
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, estimatedMinutes: mins } : item))
    );
  };

  const removeItem = (id: string) => {
    setItems((curr) => curr.filter((item) => item.id !== id));
  };

  const handleConfirm = () => {
    const selected = items.filter((i) => i.selected && i.title.trim());
    if (selected.length === 0) {
      setError('Please select at least one task to add.');
      return;
    }

    addProposedTasks(
      selected.map((item) => ({
        title: item.title.trim(),
        priority: item.priority,
        estimatedMinutes: item.estimatedMinutes,
        taskType: item.taskType,
        projectId: item.projectId || projectId,
        dueTs: Date.now() + 86400000,
        tag: 'Project',
      }))
    );

    onClose();
  };

  if (!visible) return null;

  const selectedCount = items.filter((i) => i.selected).length;

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
            maxHeight: '88%',
            paddingBottom: 28,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3 }} />
          </View>

          <ScrollView style={{ paddingHorizontal: S.l }} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.m }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: alpha(C.violet, 0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="git-branch-outline" size={22} color={C.violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>Smart Task Breakdown</Text>
                <Text style={{ color: C.faint, fontSize: 12 }}>
                  Deconstruct complex goals into actionable sub-tasks
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close breakdown modal"
              >
                <Ionicons name="close" size={22} color={C.sub} />
              </Pressable>
            </View>

            {/* Input field */}
            <View style={{ marginBottom: S.m }}>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                GOAL / OBJECTIVE TO BREAK DOWN
              </Text>
              <TextInput
                value={input}
                onChangeText={handleRegenerate}
                placeholder="e.g. Finish VLSI project, Prepare for exam"
                placeholderTextColor={C.faint}
                style={{
                  backgroundColor: C.surface2,
                  borderRadius: R.m,
                  borderWidth: 1,
                  borderColor: C.border,
                  color: C.text,
                  fontSize: 14,
                  fontWeight: '600',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              />
            </View>

            {/* Safety banner */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: alpha(C.blue, 0.08),
                borderRadius: R.m,
                borderWidth: 1,
                borderColor: alpha(C.blue, 0.25),
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: S.m,
              }}
            >
              <Ionicons name="information-circle-outline" size={16} color={C.blue} />
              <Text style={{ color: C.sub, fontSize: 12, flex: 1 }}>
                Proposed tasks are not created automatically. Review and confirm below.
              </Text>
            </View>

            {/* Proposed Tasks List */}
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
              PROPOSED TASKS ({selectedCount}/{items.length} selected)
            </Text>

            {items.map((item) => (
              <Card
                key={item.id}
                style={{
                  marginBottom: 8,
                  backgroundColor: item.selected ? C.surface2 : C.surface,
                  borderColor: item.selected ? alpha(C.violet, 0.35) : C.border,
                  padding: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => toggleSelect(item.id)} hitSlop={8}>
                    <CheckCircle checked={item.selected} color={C.violet} />
                  </Pressable>

                  <TextInput
                    value={item.title}
                    onChangeText={(t) => updateTitle(item.id, t)}
                    style={{
                      flex: 1,
                      color: item.selected ? C.text : C.faint,
                      fontSize: 13.5,
                      fontWeight: '600',
                      paddingVertical: 4,
                    }}
                  />

                  {/* Duration picker buttons */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[30, 45, 60].map((dur) => (
                      <Pressable
                        key={dur}
                        onPress={() => updateDuration(item.id, dur)}
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: R.m,
                          backgroundColor: item.estimatedMinutes === dur ? alpha(C.amber, 0.2) : C.surface3,
                          borderWidth: 1,
                          borderColor: item.estimatedMinutes === dur ? C.amber : C.border,
                        }}
                      >
                        <Text
                          style={{
                            color: item.estimatedMinutes === dur ? C.amber : C.faint,
                            fontSize: 10,
                            fontWeight: '700',
                          }}
                        >
                          {dur}m
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => removeItem(item.id)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove subtask: ${item.title}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.faint} />
                  </Pressable>
                </View>
              </Card>
            ))}

            {error ? (
              <Text style={{ color: C.red, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {error}
              </Text>
            ) : null}

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: S.m }}>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="primary"
                  icon="add"
                  onPress={handleConfirm}
                >
                  {selectedCount > 0 ? `Add Selected (${selectedCount})` : 'Add Selected'}
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="secondary"
                  onPress={onClose}
                >
                  Cancel
                </Btn>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
