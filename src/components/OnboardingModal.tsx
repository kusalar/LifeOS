import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Btn, Card } from './ui';
import { alpha, C, R, S, shadow } from '../theme';
import { fmtTime } from '../lib/dates';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (setupData?: {
    workDayStart?: number;
    workDayEnd?: number;
    deepWorkStart?: number;
    deepWorkEnd?: number;
    notificationsEnabled?: boolean;
    calendarEnabled?: boolean;
  }) => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [slide, setSlide] = useState(0);

  // Essential First-Run Setup State
  const [workDayStart, setWorkDayStart] = useState(9 * 60); // 09:00
  const [workDayEnd, setWorkDayEnd] = useState(21 * 60); // 21:00
  const [deepWorkStart, setDeepWorkStart] = useState(9 * 60); // 09:00
  const [deepWorkEnd, setDeepWorkEnd] = useState(12 * 60); // 12:00
  const [notificationsAllowed, setNotificationsAllowed] = useState(true);
  const [calendarAllowed, setCalendarAllowed] = useState(true);

  if (!visible) return null;

  const slides = [
    {
      title: 'WELCOME TO LIFEOS',
      subtitle: 'Understand your day. Decide what matters next.',
      icon: 'sparkles' as const,
      color: C.amber,
      content: (
        <View style={{ gap: 14, marginVertical: S.l }}>
          <Text style={{ color: C.sub, fontSize: 14, lineHeight: 22 }}>
            LifeOS is your calm, deterministic executive assistant. It does not bombard you with gamification or cloud sync.
          </Text>
          <Text style={{ color: C.sub, fontSize: 14, lineHeight: 22 }}>
            It understands your commitments, calculates your true usable time, and helps you execute without overwhelm.
          </Text>
        </View>
      ),
    },
    {
      title: 'HOW LIFEOS WORKS',
      subtitle: 'Deterministic Planning → Execution → Adaptive Feedback',
      icon: 'sync' as const,
      color: C.blue,
      content: (
        <View style={{ gap: 12, marginVertical: S.l }}>
          {[
            { step: 'Plan', desc: 'Type your day in plain natural language. LifeOS schedules your blocks.' },
            { step: 'Execute', desc: 'Lock into deep work with single-task Focus Mode.' },
            { step: 'Review', desc: 'Evening brief reviews actual focus vs. planned time.' },
            { step: 'Adapt', desc: 'Behavioral learning adjusts task duration estimates over time.' },
          ].map((item, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface2, padding: 12, borderRadius: R.m }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: alpha(C.blue, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.blue, fontWeight: '800', fontSize: 12 }}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{item.step}</Text>
                <Text style={{ color: C.sub, fontSize: 12 }}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      title: 'YOUR DATA STAYS LOCAL',
      subtitle: 'Private. Offline-First. No Cloud Account.',
      icon: 'shield-checkmark' as const,
      color: C.green,
      content: (
        <View style={{ gap: 14, marginVertical: S.l }}>
          <Text style={{ color: C.sub, fontSize: 14, lineHeight: 22 }}>
            LifeOS stores 100% of your data on this device in local storage.
          </Text>
          <View style={{ backgroundColor: alpha(C.green, 0.1), padding: 14, borderRadius: R.m, borderWidth: 1, borderColor: alpha(C.green, 0.25) }}>
            <Text style={{ color: C.green, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
              Zero Cloud Telemetry
            </Text>
            <Text style={{ color: C.sub, fontSize: 12, lineHeight: 18 }}>
              No analytics tracking, no external AI API calls, no third-party databases. You own your data completely and can export full backups anytime.
            </Text>
          </View>
        </View>
      ),
    },
    {
      title: 'OPTIONAL PERMISSIONS',
      subtitle: 'You are in control. Enable now or configure later.',
      icon: 'notifications' as const,
      color: C.violet,
      content: (
        <View style={{ gap: 14, marginVertical: S.l }}>
          {/* Notifications Permission */}
          <Pressable
            onPress={() => setNotificationsAllowed(!notificationsAllowed)}
            style={{
              padding: 12,
              borderRadius: R.m,
              backgroundColor: C.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Notifications</Text>
              <Text style={{ color: C.sub, fontSize: 11 }}>Task reminders, deadline warnings & quiet hours</Text>
            </View>
            <Ionicons
              name={notificationsAllowed ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={notificationsAllowed ? C.green : C.faint}
            />
          </Pressable>

          {/* Calendar Permission */}
          <Pressable
            onPress={() => setCalendarAllowed(!calendarAllowed)}
            style={{
              padding: 12,
              borderRadius: R.m,
              backgroundColor: C.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Device Calendar (Read-Only)</Text>
              <Text style={{ color: C.sub, fontSize: 11 }}>Import external events without modifying them</Text>
            </View>
            <Ionicons
              name={calendarAllowed ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={calendarAllowed ? C.green : C.faint}
            />
          </Pressable>

          <Text style={{ color: C.faint, fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>
            Permissions remain optional and can be modified in Settings at any time.
          </Text>
        </View>
      ),
    },
    {
      title: 'READY TO START',
      subtitle: 'Configure your primary work hours',
      icon: 'flag' as const,
      color: C.amber,
      content: (
        <View style={{ gap: 14, marginVertical: S.l }}>
          <Text style={{ color: C.sub, fontSize: 13 }}>
            Set your daily planning windows so LifeOS knows when you prefer to do deep work vs. rest:
          </Text>

          <View style={{ backgroundColor: C.surface2, padding: 12, borderRadius: R.m, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Workday Hours</Text>
              <Text style={{ color: C.amber, fontSize: 13, fontWeight: '700' }}>
                {fmtTime(workDayStart)} → {fmtTime(workDayEnd)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Deep Work Window</Text>
              <Text style={{ color: C.blue, fontSize: 13, fontWeight: '700' }}>
                {fmtTime(deepWorkStart)} → {fmtTime(deepWorkEnd)}
              </Text>
            </View>
          </View>

          <Text style={{ color: C.faint, fontSize: 11 }}>
            You can customize these windows anytime in the Plan → Settings tab.
          </Text>
        </View>
      ),
    },
  ];

  const current = slides[slide];
  const isLast = slide === slides.length - 1;

  const handleFinish = () => {
    onComplete({
      workDayStart,
      workDayEnd,
      deepWorkStart,
      deepWorkEnd,
      notificationsEnabled: notificationsAllowed,
      calendarEnabled: calendarAllowed,
    });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: S.l,
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: R.xl,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: alpha(current.color, 0.3),
            padding: S.xl,
            ...shadow,
          }}
        >
          {/* Header Icon */}
          <View style={{ alignItems: 'center', marginBottom: S.m }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: alpha(current.color, 0.15),
                borderWidth: 1,
                borderColor: alpha(current.color, 0.35),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name={current.icon} size={28} color={current.color} />
            </View>
            <Text
              style={{
                color: C.text,
                fontSize: 18,
                fontWeight: '900',
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              {current.title}
            </Text>
            <Text
              style={{
                color: C.sub,
                fontSize: 13,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {current.subtitle}
            </Text>
          </View>

          {/* Dynamic Slide Content */}
          <ScrollView style={{ maxHeight: 280 }}>
            {current.content}
          </ScrollView>

          {/* Slide Indicator Dots */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              marginVertical: S.m,
            }}
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === slide ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === slide ? current.color : C.border,
                }}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: S.s }}>
            {slide > 0 ? (
              <Btn
                title="Back"
                variant="ghost"
                onPress={() => setSlide(slide - 1)}
                style={{ flex: 1 }}
                accessibilityLabel="Go to previous slide"
              />
            ) : null}
            <Btn
              title={isLast ? "Get Started" : "Continue"}
              variant="primary"
              onPress={() => {
                if (isLast) {
                  handleFinish();
                } else {
                  setSlide(slide + 1);
                }
              }}
              style={{ flex: 2 }}
              accessibilityLabel={isLast ? "Complete onboarding and get started" : "Continue to next slide"}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
