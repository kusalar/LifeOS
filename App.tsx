import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AskSheet } from './src/components/AskSheet';
import { ExpenseSheet } from './src/components/ExpenseSheet';
import { NowModal } from './src/components/NowModal';
import { ReminderSheet } from './src/components/ReminderSheet';
import { TabBar } from './src/components/TabBar';
import { TaskSheet } from './src/components/TaskSheet';
import { StoreProvider, UIContext, useStore } from './src/lib/store';
import { MoneyScreen } from './src/screens/MoneyScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { C } from './src/theme';
import type { Task } from './src/types';

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
  const { ready } = useStore();
  const [askOpen, setAskOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [remOpen, setRemOpen] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);

  // Preload icon fonts for web
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded || !ready) return <Splash />;

  const handleOpenTask = (task?: Task) => {
    setTaskToEdit(task || null);
    setTaskOpen(true);
  };

  return (
    <UIContext.Provider
      value={{
        openAsk: () => setAskOpen(true),
        openExpense: () => setExpOpen(true),
        openTask: handleOpenTask,
        openReminder: () => setRemOpen(true),
        openNowModal: () => setNowOpen(true),
      }}
    >
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Today" component={TodayScreen} />
            <Tab.Screen name="Plan" component={PlannerScreen} />
            <Tab.Screen name="Money" component={MoneyScreen} />
            <Tab.Screen name="Report" component={ReportScreen} />
          </Tab.Navigator>
        </NavigationContainer>

        {/* Global Modal Sheets */}
        <AskSheet visible={askOpen} onClose={() => setAskOpen(false)} />
        <ExpenseSheet visible={expOpen} onClose={() => setExpOpen(false)} />
        <TaskSheet
          visible={taskOpen}
          onClose={() => {
            setTaskOpen(false);
            setTaskToEdit(null);
          }}
          initialTask={taskToEdit}
        />
        <ReminderSheet visible={remOpen} onClose={() => setRemOpen(false)} />
        <NowModal visible={nowOpen} onClose={() => setNowOpen(false)} />

        <StatusBar style="light" />
      </SafeAreaProvider>
    </UIContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
