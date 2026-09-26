import 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AskSheet } from './src/components/AskSheet';
import { ExpenseSheet } from './src/components/ExpenseSheet';
import { BreakdownModal } from './src/components/BreakdownModal';
import { FocusModal } from './src/components/FocusModal';
import { HabitSheet } from './src/components/HabitSheet';
import { HabitsModal } from './src/components/HabitsModal';
import { NowModal } from './src/components/NowModal';
import { ProjectSheet } from './src/components/ProjectSheet';
import { ReminderSheet } from './src/components/ReminderSheet';
import { RescheduleModal } from './src/components/RescheduleModal';
import { ReviewModal } from './src/components/ReviewModal';
import { TabBar } from './src/components/TabBar';
import { TaskSheet } from './src/components/TaskSheet';
import { OnboardingModal } from './src/components/OnboardingModal';
import { WeeklyPlanModal } from './src/components/WeeklyPlanModal';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StoreProvider, UIContext, useStore } from './src/lib/store';
import { MoneyScreen } from './src/screens/MoneyScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { C } from './src/theme';
import type { AdaptiveProposal, Habit, Project, Task } from './src/types';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: C.amber,
    background: C.bg,
    card: C.surface,
    text: C.text,
    border: C.border,
    notification: C.amber,
  },
};

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: 'rgba(255,180,84,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(255,180,84,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="sparkles" size={30} color={C.amber} />
      </View>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>LifeOS</Text>
      <Text style={{ color: C.faint, fontSize: 12 }}>Your phone should manage your life, not just display it.</Text>
      <ActivityIndicator color={C.amber} style={{ marginTop: 8 }} />
    </View>
  );
}

function Root() {
  const { state, ready, completeOnboarding } = useStore();
  const [askOpen, setAskOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultTaskProjId, setDefaultTaskProjId] = useState<string | undefined>(undefined);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [remOpen, setRemOpen] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);

  // V1.1 Focus, Habits, and Review modal states
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>(undefined);
  const [habitOpen, setHabitOpen] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [habitsModalOpen, setHabitsModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDateKey, setReviewDateKey] = useState<string | undefined>(undefined);

  // V2 Adaptive Rescheduling and Smart Breakdown state
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownInput, setBreakdownInput] = useState<string | undefined>(undefined);
  const [breakdownProjId, setBreakdownProjId] = useState<string | undefined>(undefined);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleProposal, setRescheduleProposal] = useState<AdaptiveProposal | null>(null);
  const [weeklyPlanOpen, setWeeklyPlanOpen] = useState(false);

  // Preload icon fonts for web
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded || !ready) return <Splash />;

  const handleOpenTask = (task?: Task, defaultProjectId?: string) => {
    setTaskToEdit(task || null);
    setDefaultTaskProjId(defaultProjectId);
    setTaskOpen(true);
  };

  const handleOpenProject = (project?: Project) => {
    setProjectToEdit(project || null);
    setProjectOpen(true);
  };

  const handleOpenFocus = (taskId?: string) => {
    setFocusTaskId(taskId);
    setFocusOpen(true);
  };

  const handleOpenHabit = (habit?: Habit) => {
    setHabitToEdit(habit || null);
    setHabitOpen(true);
  };

  const handleOpenReview = (dateKey?: string) => {
    setReviewDateKey(dateKey);
    setReviewOpen(true);
  };

  const handleOpenBreakdown = (initialInput?: string, projectId?: string) => {
    setBreakdownInput(initialInput);
    setBreakdownProjId(projectId);
    setBreakdownOpen(true);
  };

  const handleOpenReschedule = (proposal?: AdaptiveProposal) => {
    setRescheduleProposal(proposal || null);
    setRescheduleOpen(true);
  };

  return (
    <UIContext.Provider
      value={{
        openAsk: () => setAskOpen(true),
        openExpense: () => setExpOpen(true),
        openTask: handleOpenTask,
        openReminder: () => setRemOpen(true),
        openNowModal: () => setNowOpen(true),
        openProject: handleOpenProject,
        openFocusModal: handleOpenFocus,
        openHabitSheet: handleOpenHabit,
        openReviewModal: handleOpenReview,
        openHabitsModal: () => setHabitsModalOpen(true),
        openBreakdownModal: handleOpenBreakdown,
        openRescheduleModal: handleOpenReschedule,
        openWeeklyPlanModal: () => setWeeklyPlanOpen(true),
      }}
    >
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Today" component={TodayScreen} />
            <Tab.Screen name="Plan" component={PlannerScreen} />
            <Tab.Screen name="Projects" component={ProjectsScreen} />
            <Tab.Screen name="Money" component={MoneyScreen} />
            <Tab.Screen name="Report" component={ReportScreen} />
          </Tab.Navigator>
        </NavigationContainer>

        {/* Global Modal Sheets & Operating System Views */}
        <AskSheet visible={askOpen} onClose={() => setAskOpen(false)} />
        <ExpenseSheet visible={expOpen} onClose={() => setExpOpen(false)} />
        <TaskSheet
          visible={taskOpen}
          onClose={() => {
            setTaskOpen(false);
            setTaskToEdit(null);
            setDefaultTaskProjId(undefined);
          }}
          initialTask={taskToEdit}
          defaultProjectId={defaultTaskProjId}
        />
        <ProjectSheet
          visible={projectOpen}
          onClose={() => {
            setProjectOpen(false);
            setProjectToEdit(null);
          }}
          initialProject={projectToEdit}
        />
        <ReminderSheet visible={remOpen} onClose={() => setRemOpen(false)} />
        <NowModal visible={nowOpen} onClose={() => setNowOpen(false)} />

        <FocusModal
          visible={focusOpen}
          taskId={focusTaskId}
          onClose={() => {
            setFocusOpen(false);
            setFocusTaskId(undefined);
          }}
        />
        <HabitSheet
          visible={habitOpen}
          initialHabit={habitToEdit}
          onClose={() => {
            setHabitOpen(false);
            setHabitToEdit(null);
          }}
        />
        <HabitsModal visible={habitsModalOpen} onClose={() => setHabitsModalOpen(false)} />
        <ReviewModal
          visible={reviewOpen}
          dateKey={reviewDateKey}
          onClose={() => {
            setReviewOpen(false);
            setReviewDateKey(undefined);
          }}
        />
        <BreakdownModal
          visible={breakdownOpen}
          initialInput={breakdownInput}
          projectId={breakdownProjId}
          onClose={() => {
            setBreakdownOpen(false);
            setBreakdownInput(undefined);
            setBreakdownProjId(undefined);
          }}
        />
        <RescheduleModal
          visible={rescheduleOpen}
          proposal={rescheduleProposal}
          onClose={() => {
            setRescheduleOpen(false);
            setRescheduleProposal(null);
          }}
        />
        <WeeklyPlanModal
          visible={weeklyPlanOpen}
          onClose={() => setWeeklyPlanOpen(false)}
        />

        <OnboardingModal
          visible={state ? !state.onboardingCompleted : false}
          onComplete={completeOnboarding}
        />

        <StatusBar style="light" />
      </SafeAreaProvider>
    </UIContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
