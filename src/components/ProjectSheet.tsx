import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { atTime } from '../lib/dates';
import { useStore } from '../lib/store';
import type { Project, ProjectStatus } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn } from './ui';

const COLORS = [
  '#60A5FA', // Blue
  '#A78BFA', // Violet
  '#FFB454', // Amber
  '#2DD4BF', // Teal
  '#34D399', // Green
  '#F472B6', // Pink
];

const ICONS = [
  'folder-outline',
  'hardware-chip-outline',
  'school-outline',
  'briefcase-outline',
  'code-slash-outline',
  'rocket-outline',
  'trophy-outline',
  'bulb-outline',
];

export function ProjectSheet({
  visible,
  onClose,
  initialProject,
}: {
  visible: boolean;
  onClose: () => void;
  initialProject?: Project | null;
}) {
  const { addProject, updateProject, deleteProject } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [dueDaysOffset, setDueDaysOffset] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialProject) {
        setName(initialProject.name);
        setDescription(initialProject.description || '');
        setColor(initialProject.color || COLORS[0]);
        setIcon(initialProject.icon || ICONS[0]);
        setStatus(initialProject.status || 'active');
        setDueDaysOffset(null);
        setError('');
      } else {
        setName('');
        setDescription('');
        setColor(COLORS[0]);
        setIcon(ICONS[0]);
        setStatus('active');
        setDueDaysOffset(7); // Default 1 week
        setError('');
      }
    }
  }, [visible, initialProject]);

  const save = () => {
    if (!name.trim()) {
      setError('Please enter a project name');
      return;
    }

    let deadline: number | undefined;
    if (dueDaysOffset !== null) {
      deadline = atTime(dueDaysOffset, 18 * 60); // 6:00 PM
    } else if (initialProject?.deadline) {
      deadline = initialProject.deadline;
    }

    if (initialProject) {
      updateProject(initialProject.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        status,
        deadline,
      });
    } else {
      addProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        status,
        deadline,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!initialProject) return;
    if (Platform.OS === 'web') {
      if (window.confirm?.(`Are you sure you want to delete "${initialProject.name}"? Tasks will be unlinked but kept safe.`)) {
        deleteProject(initialProject.id);
        onClose();
      }
    } else {
      Alert.alert(
        'Delete Project',
        `Are you sure you want to delete "${initialProject.name}"? Tasks will be unlinked but preserved.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteProject(initialProject.id);
              onClose();
            },
          },
        ]
      );
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
                backgroundColor: alpha(color, 0.16),
                borderWidth: 1,
                borderColor: alpha(color, 0.4),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>
                {initialProject ? 'Edit Project' : 'New Project'}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12 }}>Container for related tasks & progress</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close project editor sheet"
            >
              <Ionicons name="close" size={22} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Project Name */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              PROJECT NAME *
            </Text>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError('');
              }}
              placeholder="e.g. VLSI Training, Campus Capstone"
              placeholderTextColor={C.faint}
              autoFocus={!initialProject}
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

            {/* Description */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Goal, milestone notes, or scope"
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

            {/* Color Accent Picker */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              ACCENT COLOR
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: S.m }}>
              {COLORS.map((col) => {
                const active = color === col;
                return (
                  <Pressable
                    key={col}
                    onPress={() => setColor(col)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: col,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: active ? 2.5 : 0,
                      borderColor: '#FFFFFF',
                    }}
                  >
                    {active ? <Ionicons name="checkmark" size={18} color="#000" /> : null}
                  </Pressable>
                );
              })}
            </View>

            {/* Icon Picker */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              ICON
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {ICONS.map((ic) => {
                const active = icon === ic;
                return (
                  <Pressable
                    key={ic}
                    onPress={() => setIcon(ic)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: active ? alpha(color, 0.2) : C.surface2,
                      borderWidth: 1,
                      borderColor: active ? color : C.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={ic as any} size={18} color={active ? color : C.faint} />
                  </Pressable>
                );
              })}
            </View>

            {/* Target Deadline */}
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              TARGET DEADLINE (OPTIONAL)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.m }}>
              {[
                { label: 'In 3 Days', offset: 3 },
                { label: 'In 1 Week', offset: 7 },
                { label: 'In 2 Weeks', offset: 14 },
                { label: 'In 1 Month', offset: 30 },
                { label: 'No Deadline', offset: null },
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

            {/* Status (If editing) */}
            {initialProject ? (
              <>
                <Text style={{ color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
                  STATUS
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.m }}>
                  {(['active', 'completed', 'archived'] as ProjectStatus[]).map((st) => {
                    const active = status === st;
                    return (
                      <Pressable
                        key={st}
                        onPress={() => setStatus(st)}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          paddingVertical: 9,
                          borderRadius: R.l,
                          backgroundColor: active ? alpha(C.amber, 0.15) : C.surface2,
                          borderWidth: 1,
                          borderColor: active ? alpha(C.amber, 0.5) : C.border,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? C.amber : C.sub,
                            fontSize: 12.5,
                            fontWeight: active ? '800' : '600',
                            textTransform: 'capitalize',
                          }}
                        >
                          {st}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: S.m }}>
              {initialProject ? (
                <Btn
                  title="Delete"
                  variant="danger"
                  icon="trash-outline"
                  onPress={handleDelete}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Btn
                title={initialProject ? 'Save Project' : 'Create Project'}
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
