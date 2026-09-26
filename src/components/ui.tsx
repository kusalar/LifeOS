import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import type { Priority } from '../types';
import { alpha, C, R, S } from '../theme';

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: C.surface,
            borderRadius: R.xl,
            borderWidth: 1,
            borderColor: C.border,
            padding: S.l,
            opacity: pressed ? 0.88 : 1,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: C.surface,
          borderRadius: R.xl,
          borderWidth: 1,
          borderColor: C.border,
          padding: S.l,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      style={[
        {
          color: C.faint,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.3,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function SectionHeader({
  title,
  right,
  icon,
  onRightPress,
}: {
  title: string;
  right?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.xl, marginBottom: S.m, paddingHorizontal: 2 }}>
      {icon ? <Ionicons name={icon} size={15} color={C.faint} style={{ marginRight: 6 }} /> : null}
      <Label>{title}</Label>
      <View style={{ flex: 1 }} />
      {right ? (
        onRightPress ? (
          <Pressable onPress={onRightPress} hitSlop={8}>
            <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>{right}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: '600' }}>{right}</Text>
        )
      ) : null}
    </View>
  );
}

export function Chip({
  children,
  color = C.sub,
  style,
  onPress,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: R.pill,
          backgroundColor: alpha(color, 0.12),
          borderWidth: 1,
          borderColor: alpha(color, 0.25),
          paddingHorizontal: 10,
          paddingVertical: 5,
          gap: 5,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {content}
      </Pressable>
    );
  }

  return content;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = {
    critical: { color: C.red, label: 'Critical', bg: alpha(C.red, 0.15) },
    important: { color: C.amber, label: 'Important', bg: alpha(C.amber, 0.15) },
    normal: { color: C.blue, label: 'Normal', bg: alpha(C.blue, 0.12) },
  }[priority] || { color: C.sub, label: priority, bg: alpha(C.sub, 0.12) };

  return (
    <View
      style={{
        borderRadius: R.pill,
        backgroundColor: meta.bg,
        borderWidth: 1,
        borderColor: alpha(meta.color, 0.35),
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: meta.color, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 }}>
        {meta.label}
      </Text>
    </View>
  );
}

export function Bar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  const clamped = Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
  return (
    <View style={{ height, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' }}>
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: R.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function IconBadge({
  icon,
  color,
  size = 38,
  iconSize = 18,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        backgroundColor: alpha(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </View>
  );
}

export function Btn({
  title,
  children,
  onPress,
  variant = 'primary',
  size,
  icon,
  loading,
  style,
  compact,
}: {
  title?: string;
  children?: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'violet' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const isPrimary = variant === 'primary';
  const isViolet = variant === 'violet';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary' || variant === 'ghost';
  const bg = isPrimary
    ? C.amber
    : isViolet
    ? alpha(C.violet, 0.16)
    : isDanger
    ? alpha(C.red, 0.16)
    : isSecondary
    ? C.surface2
    : C.surface2;
  const fg = isPrimary
    ? '#1A1206'
    : isViolet
    ? C.violet
    : isDanger
    ? C.red
    : C.text;

  const isCompact = compact || size === 'small';
  const label = typeof children === 'string' ? children : title;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: R.l,
          backgroundColor: bg,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: isViolet ? alpha(C.violet, 0.35) : isDanger ? alpha(C.red, 0.35) : C.border2,
          paddingVertical: isCompact ? 9 : size === 'large' ? 16 : 14,
          paddingHorizontal: isCompact ? 14 : 18,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={isCompact ? 15 : 17} color={fg} /> : null}
          {label ? <Text style={{ color: fg, fontWeight: '800', fontSize: isCompact ? 13 : 15 }}>{label}</Text> : null}
          {typeof children !== 'string' ? children : null}
        </>
      )}
    </Pressable>
  );
}

export function CheckCircle({
  checked,
  color = C.green,
  onPress,
}: {
  checked: boolean;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: checked ? color : C.border2,
        backgroundColor: checked ? alpha(color, 0.18) : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Ionicons name="checkmark" size={16} color={color} /> : null}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  actionText,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <IconBadge icon={icon} color={C.faint} size={50} iconSize={24} />
      <Text style={{ color: C.sub, fontWeight: '700', fontSize: 15, marginTop: 4 }}>{title}</Text>
      <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 18 }}>{sub}</Text>
      {actionText && onAction ? (
        <Btn title={actionText} compact onPress={onAction} style={{ marginTop: 8 }} />
      ) : null}
    </View>
  );
}
