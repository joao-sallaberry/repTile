import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { hasSeenWelcome } from '@/lib/welcome';
import { theme } from '@/theme';

export default function TabsLayout() {
  if (!hasSeenWelcome()) return <Redirect href="/welcome" />;
  return (
    <NativeTabs
      backgroundColor={theme.colors.elevation.level2}
      indicatorColor={theme.colors.primaryContainer}
      labelStyle={{ selected: { color: theme.colors.onSurface } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <NativeTabs.Trigger.Label>Treinos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.clipboard" md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>Histórico</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="exercises">
        <NativeTabs.Trigger.Label>Exercícios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" md="emoji_events" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
