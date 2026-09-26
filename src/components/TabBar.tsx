import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, C, R, shadow } from '../theme';

const TABS: Record<string, { icon: string; iconActive: string }> = {
  Today: { icon: 'home-outline', iconActive: 'home' },
  Plan: { icon: 'sparkles-outline', iconActive: 'sparkles' },
  Projects: { icon: 'folder-outline', iconActive: 'folder' },
  Money: { icon: 'wallet-outline', iconActive: 'wallet' },
  Report: { icon: 'stats-chart-outline', iconActive: 'stats-chart' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInDown.delay(250).springify()}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 10),
        borderRadius: R.xxl,
        backgroundColor: 'rgba(14,21,36,0.96)',
        borderWidth: 1,
        borderColor: C.border2,
        flexDirection: 'row',
        paddingTop: 8,
        paddingBottom: 8,
        ...shadow,
      }}
    >
      {state.routes.map((route: (typeof state.routes)[number], index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;
        const focused = state.index === index;
        const meta = TABS[route.name] ?? TABS.Today;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: R.pill,
                paddingHorizontal: focused ? 14 : 0,
                paddingVertical: 6,
                backgroundColor: focused ? alpha(C.amber, 0.14) : 'transparent',
              }}
            >
              <Ionicons
                name={(focused ? meta.iconActive : meta.icon) as keyof typeof Ionicons.glyphMap}
                size={19}
                color={focused ? C.amber : C.faint}
              />
              {focused ? (
                <Text style={{ color: C.amber, fontWeight: '800', fontSize: 12.5 }}>{String(label)}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}
