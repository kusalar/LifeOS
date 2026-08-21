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
import { addDays, atTime, dueLabel, fmtDateShort, fmtTime } from '../lib/dates';
import { useStore } from '../lib/store';
import type { Priority, Task } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn, PriorityBadge } from './ui';

const PRIORITIES: Priority[] = ['critical', 'important', 'normal'];
const TAGS = ['College', 'Exam', 'Academic', 'Work', 'Errand', 'Habit', 'Personal'];

export function TaskSheet({
  visible,
  onClose,
  initialTask,
}: {
  visible: boolean;
  onClose: () => void;
  initialTask?: Task | null;
}) {
  const { addTask, updateTask, deleteTask } = useStore();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('important');
  const [dueDaysOffset, setDueDaysOffset] = useState<number>(0);
  const [dueHour, setDueHour] = useState<number>(18); // 6:00 PM default
  const [tag, setTag] = useState('College');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialTask) {
        setTitle(initialTask.title);
        setPriority(initialTask.priority);
        setTag(initialTask.tag || 'College');
        setNote(initialTask.note || '');
        setError('');
      } else {
        setTitle('');
        setPriority('important');
        setDueDaysOffset(0);
        setDueHour(18);
        setTag('College');
        setNote('');
        setError('');
      }
    }
  }, [visible, initialTask]);

  const save = () => {
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }

    const dueTs = atTime(dueDaysOffset, dueHour * 60);

    if (initialTask) {
      updateTask(initialTask.id, {
        title: title.trim(),
        priority,
        tag,
        dueTs,
        note: note.trim() || undefined,
      });
    } else {
      addTask({
        title: title.trim(),
        priority,
        dueTs,
        tag,
        note: note.trim() || undefined,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (initialTask) {
      deleteTask(initialTask.id);
      onClose();
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
            paddingBottom: Platform.OS === 'ios' ? 36 : 26,
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
              <Ionicons name="checkbox-outline" size={20} color={C.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>
                {initialTask ? 'Edit Task' : 'Add New Task'}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>Set priority, due date & category</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              TASK TITLE
            </Text>
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (error) setError('');
              }}
              placeholder="e.g. Finish digital electronics lab writeup"
              placeholderTextColor={C.faint}
              autoFocus={!initialTask}
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: error ? alpha(C.red, 0.6) : C.border2,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: C.text,
                fontSize: 15,
                fontWeight: '600',
                marginBottom: error ? 4 : S.m,
              }}
            />
            {error ? (
              <Text style={{ color: C.red, fontSize: 12, fontWeight: '600', marginBottom: S.m }}>{error}</Text>
            ) : null}

            {/* Priority */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              PRIORITY
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.m }}>
              {PRIORITIES.map((p) => {
                const active = priority === p;
                const meta = {
                  critical: { color: C.red, label: 'Critical', icon: 'flame' },
                  important: { color: C.amber, label: 'Important', icon: 'alert-circle' },
                  normal: { color: C.blue, label: 'Normal', icon: 'radio-button-on' },
                }[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: R.l,
                      backgroundColor: active ? alpha(meta.color, 0.16) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? alpha(meta.color, 0.6) : C.border,
                      paddingVertical: 10,
                    }}
                  >
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? meta.color : C.faint}
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

            {/* Due Date Shortcut Chips */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              DUE DATE
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {[
                { label: 'Today', offset: 0 },
                { label: 'Tomorrow', offset: 1 },
                { label: 'In 2 Days', offset: 2 },
                { label: 'In 4 Days', offset: 4 },
                { label: 'Next Week', offset: 7 },
              ].map((chip) => {
                const active = dueDaysOffset === chip.offset;
                return (
                  <Pressable
                    key={chip.label}
                    onPress={() => setDueDaysOffset(chip.offset)}
                    style={{
                      borderRadius: R.pill,
                      backgroundColor: active ? alpha(C.amber, 0.16) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? alpha(C.amber, 0.5) : C.border,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? C.amber : C.sub,
                        fontSize: 12.5,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Tag Selection */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              TAG
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {TAGS.map((t) => {
                const active = tag === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTag(t)}
                    style={{
                      borderRadius: R.pill,
                      backgroundColor: active ? alpha(C.violet, 0.16) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? alpha(C.violet, 0.5) : C.border,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? C.violet : C.sub,
                        fontSize: 12,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional Note */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              NOTE / DETAILS (OPTIONAL)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Chapter 3 slides, 4 questions"
              placeholderTextColor={C.faint}
              style={{
                backgroundColor: C.surface2,
                borderRadius: R.l,
                borderWidth: 1,
                borderColor: C.border2,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: C.text,
                fontSize: 13.5,
                marginBottom: S.l,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {initialTask ? (
                <Btn
                  title="Delete"
                  variant="danger"
                  icon="trash-outline"
                  onPress={handleDelete}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Btn
                title={initialTask ? 'Save Changes' : 'Create Task'}
                icon="checkmark"
                onPress={save}
                style={{ flex: 2 }}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
