import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useStore } from '../lib/store';
import type { Habit } from '../types';
import { alpha, C, R, S } from '../theme';
import { Btn } from './ui';

const HABIT_COLORS = [
  '#A78BFA', // Violet
  '#34D399', // Green
  '#60A5FA', // Blue
  '#FFB454', // Amber
  '#F472B6', // Pink
  '#2DD4BF', // Teal
];

const HABIT_ICONS = [
  'checkmark-circle-outline',
  'book-outline',
  'fitness-outline',
  'water-outline',
  'bed-outline',
  'heart-outline',
  'leaf-outline',
  'code-slash-outline',
];

export function HabitSheet({
  visible,
  onClose,
  initialHabit,
}: {
  visible: boolean;
  onClose: () => void;
  initialHabit?: Habit | null;
}) {
  const { addHabit, updateHabit, deactivateHabit, reactivateHabit } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialHabit) {
        setName(initialHabit.name);
        setDescription(initialHabit.description || '');
        setColor(initialHabit.color || HABIT_COLORS[0]);
        setIcon(initialHabit.icon || HABIT_ICONS[0]);
        setError('');
      } else {
        setName('');
        setDescription('');
        setColor(HABIT_COLORS[0]);
        setIcon(HABIT_ICONS[0]);
        setError('');
      }
    }
  }, [visible, initialHabit]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a habit title.');
      return;
    }

    if (initialHabit) {
      updateHabit(initialHabit.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
    } else {
      addHabit({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
    }

    onClose();
  };

  const handleToggleActive = () => {
    if (!initialHabit) return;
    if (initialHabit.active) {
      deactivateHabit(initialHabit.id);
    } else {
      reactivateHabit(initialHabit.id);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={styles.container}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.4) }]}>
                <Ionicons name={icon as any} size={20} color={color} />
              </View>
              <View>
                <Text style={styles.title}>{initialHabit ? 'Edit Habit' : 'New Habit'}</Text>
                <Text style={styles.subtitle}>Daily recurring behavior</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close habit editor sheet"
            >
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>HABIT NAME</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError('');
                }}
                placeholder="e.g. Study, Exercise, Read"
                placeholderTextColor={C.faint}
                autoFocus={!initialHabit}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DESCRIPTION / INTENTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. 30 minutes of deep study before lunch"
                placeholderTextColor={C.faint}
                multiline
              />
            </View>

            {/* Color selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COLOR THEME</Text>
              <View style={styles.chipRow}>
                {HABIT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      color === c && styles.colorCircleSelected,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Icon selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ICON</Text>
              <View style={styles.chipRow}>
                {HABIT_ICONS.map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => setIcon(ic)}
                    style={[
                      styles.iconCircle,
                      icon === ic && { borderColor: color, backgroundColor: alpha(color, 0.2) },
                    ]}
                  >
                    <Ionicons name={ic as any} size={18} color={icon === ic ? color : C.faint} />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Save Button */}
            <View style={styles.actionContainer}>
              <Btn variant="primary" size="large" onPress={handleSave}>
                {initialHabit ? 'Save Changes' : 'Create Habit'}
              </Btn>

              {initialHabit ? (
                <Pressable onPress={handleToggleActive} style={styles.deactivateBtn}>
                  <Ionicons
                    name={initialHabit.active ? 'pause-circle-outline' : 'play-circle-outline'}
                    size={16}
                    color={initialHabit.active ? C.amber : C.green}
                  />
                  <Text style={[styles.deactivateText, { color: initialHabit.active ? C.amber : C.green }]}>
                    {initialHabit.active ? 'Deactivate Habit (Keep History)' : 'Reactivate Habit'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,6,12,0.80)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xxl,
    borderTopRightRadius: R.xxl,
    borderWidth: 1,
    borderColor: alpha(C.violet, 0.4),
    padding: S.l,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    maxHeight: '85%',
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surface3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.l,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: C.faint,
    fontSize: 12,
  },
  scroll: {
    gap: S.m,
  },
  errorText: {
    color: C.pink,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: alpha(C.pink, 0.1),
    padding: 8,
    borderRadius: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.m,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: C.text,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContainer: {
    marginTop: S.m,
    gap: S.m,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  deactivateText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
