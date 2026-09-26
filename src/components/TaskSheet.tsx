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
import { useStore, useUI } from '../lib/store';
import type { Priority, Task, TaskType } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn, PriorityBadge } from './ui';

const PRIORITIES: Priority[] = ['critical', 'important', 'normal'];
const TAGS = ['College', 'Exam', 'Academic', 'Work', 'Errand', 'Habit', 'Personal'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const TASK_TYPES: { id: TaskType; label: string; icon: string }[] = [
  { id: 'deep_work', label: 'Deep Work', icon: 'flame-outline' },
  { id: 'quick_task', label: 'Quick Task', icon: 'flash-outline' },
  { id: 'admin', label: 'Admin', icon: 'briefcase-outline' },
  { id: 'personal', label: 'Personal', icon: 'person-outline' },
];

export function TaskSheet({
  visible,
  onClose,
  initialTask,
  defaultProjectId,
}: {
  visible: boolean;
  onClose: () => void;
  initialTask?: Task | null;
  defaultProjectId?: string;
}) {
  const { state, addTask, updateTask, deleteTask } = useStore();
  const { openFocusModal, openBreakdownModal } = useUI();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('important');
  const [dueDaysOffset, setDueDaysOffset] = useState<number>(0);
  const [dueHour, setDueHour] = useState<number>(18); // 6:00 PM default
  const [tag, setTag] = useState('College');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(45);
  const [taskType, setTaskType] = useState<TaskType | undefined>(undefined);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const projects = state?.projects ?? [];
  const otherTasks = (state?.tasks ?? []).filter((t) => !t.done && t.id !== initialTask?.id);

  useEffect(() => {
    if (visible) {
      if (initialTask) {
        setTitle(initialTask.title);
        setPriority(initialTask.priority);
        setTag(initialTask.tag || 'College');
        setProjectId(initialTask.projectId);
        setEstimatedMinutes(initialTask.estimatedMinutes || 45);
        setTaskType(initialTask.taskType);
        setBlockedBy(initialTask.blockedBy || []);
        setNote(initialTask.note || '');
        setError('');
      } else {
        setTitle('');
        setPriority('important');
        setDueDaysOffset(0);
        setDueHour(18);
        setTag('College');
        setProjectId(defaultProjectId);
        setEstimatedMinutes(45);
        setTaskType(undefined);
        setBlockedBy([]);
        setNote('');
        setError('');
      }
    }
  }, [visible, initialTask, defaultProjectId]);

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
        projectId,
        estimatedMinutes,
        taskType,
        blockedBy,
        note: note.trim() || undefined,
      });
    } else {
      addTask({
        title: title.trim(),
        priority,
        dueTs,
        tag,
        projectId,
        estimatedMinutes,
        taskType,
        blockedBy,
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
            maxHeight: '92%',
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
              <Text style={{ color: C.faint, fontSize: 12 }}>Set project, priority, duration & due date</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              TASK TITLE *
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

            {/* Project Selection */}
            {projects.length > 0 ? (
              <>
                <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
                  PROJECT (OPTIONAL)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
                  <Pressable
                    onPress={() => setProjectId(undefined)}
                    style={{
                      borderRadius: R.pill,
                      backgroundColor: projectId === undefined ? alpha(C.amber, 0.16) : C.surface2,
                      borderWidth: 1,
                      borderColor: projectId === undefined ? alpha(C.amber, 0.5) : C.border,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: projectId === undefined ? C.amber : C.sub,
                        fontSize: 12,
                        fontWeight: projectId === undefined ? '800' : '600',
                      }}
                    >
                      Standalone (No Project)
                    </Text>
                  </Pressable>

                  {projects.map((p) => {
                    const active = projectId === p.id;
                    const col = p.color || C.blue;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setProjectId(p.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          borderRadius: R.pill,
                          backgroundColor: active ? alpha(col, 0.2) : C.surface2,
                          borderWidth: 1,
                          borderColor: active ? col : C.border,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Ionicons name={(p.icon as any) || 'folder-outline'} size={13} color={active ? col : C.faint} />
                        <Text
                          style={{
                            color: active ? col : C.sub,
                            fontSize: 12,
                            fontWeight: active ? '800' : '600',
                          }}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
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

            {/* Estimated Duration */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              ESTIMATED DURATION
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {DURATIONS.map((dur) => {
                const active = estimatedMinutes === dur;
                return (
                  <Pressable
                    key={dur}
                    onPress={() => setEstimatedMinutes(dur)}
                    style={{
                      borderRadius: R.pill,
                      backgroundColor: active ? alpha(C.teal, 0.18) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? alpha(C.teal, 0.5) : C.border,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? C.teal : C.sub,
                        fontSize: 12,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {dur < 60 ? `${dur}m` : `${dur / 60}h`}
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
              CATEGORY TAG
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

            {/* Optional Task Type */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
              WORK TYPE (OPTIONAL)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {TASK_TYPES.map((tt) => {
                const active = taskType === tt.id;
                return (
                  <Pressable
                    key={tt.id}
                    onPress={() => setTaskType(active ? undefined : tt.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: R.pill,
                      backgroundColor: active ? alpha(C.teal, 0.18) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? C.teal : C.border,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Ionicons name={tt.icon as any} size={13} color={active ? C.teal : C.faint} />
                    <Text
                      style={{
                        color: active ? C.teal : C.sub,
                        fontSize: 12,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {tt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional Dependencies (Blocked By) */}
            {otherTasks.length > 0 ? (
              <>
                <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>
                  DEPENDENCIES / BLOCKED BY (OPTIONAL)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
                  {otherTasks.slice(0, 8).map((ot) => {
                    const isBlocking = blockedBy.includes(ot.id);
                    return (
                      <Pressable
                        key={ot.id}
                        onPress={() => {
                          setBlockedBy((prev) =>
                            isBlocking ? prev.filter((id) => id !== ot.id) : [...prev, ot.id]
                          );
                        }}
                        style={{
                          borderRadius: R.pill,
                          backgroundColor: isBlocking ? alpha(C.red, 0.16) : C.surface2,
                          borderWidth: 1,
                          borderColor: isBlocking ? alpha(C.red, 0.5) : C.border,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: isBlocking ? C.red : C.sub,
                            fontSize: 12,
                            fontWeight: isBlocking ? '800' : '600',
                          }}
                          numberOfLines={1}
                        >
                          {isBlocking ? '🚫 ' : ''}{ot.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

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
                marginBottom: S.m,
              }}
            />

            {/* Smart Breakdown Action */}
            <Pressable
              onPress={() => {
                const query = title.trim() || initialTask?.title || '';
                openBreakdownModal(query, projectId);
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: R.l,
                backgroundColor: alpha(C.amber, 0.12),
                borderWidth: 1,
                borderColor: alpha(C.amber, 0.35),
                marginBottom: S.m,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="git-branch-outline" size={16} color={C.amber} />
              <Text style={{ color: C.amber, fontSize: 13, fontWeight: '700' }}>
                Break Down into Subtasks
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {initialTask && !initialTask.done ? (
                <Btn
                  variant="primary"
                  icon="flash-outline"
                  onPress={() => {
                    save();
                    openFocusModal(initialTask.id);
                  }}
                  style={{ width: '100%', backgroundColor: C.violet, marginBottom: 4 }}
                >
                  START FOCUS
                </Btn>
              ) : null}
              {initialTask ? (
                <Btn
                  variant="danger"
                  icon="trash-outline"
                  onPress={handleDelete}
                  style={{ flex: 1 }}
                >
                  Delete
                </Btn>
              ) : null}
              <Btn
                variant="primary"
                icon="checkmark"
                onPress={save}
                style={{ flex: 2 }}
              >
                {initialTask ? 'Save Changes' : 'Create Task'}
              </Btn>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
