import { DarkTheme as NavDarkTheme, type Theme as NavTheme } from 'expo-router';
import { MD3DarkTheme, type MD3Theme } from 'react-native-paper';

export const theme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FF7A1A',
    onPrimary: '#1A0B00',
    primaryContainer: '#5C2A00',
    onPrimaryContainer: '#FFDCC7',
    secondary: '#4FC3F7',
    onSecondary: '#002230',
    secondaryContainer: '#004D66',
    onSecondaryContainer: '#C5ECFF',
    tertiary: '#7CD992',
    onTertiary: '#00210A',
    tertiaryContainer: '#1E5130',
    onTertiaryContainer: '#B5F5C3',
    background: '#111318',
    surface: '#111318',
    surfaceVariant: '#262A31',
    elevation: {
      level0: 'transparent',
      level1: '#1A1D23',
      level2: '#1F2229',
      level3: '#24272E',
      level4: '#262A31',
      level5: '#2A2E36',
    },
  },
};

export const navTheme: NavTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.elevation.level2,
    text: theme.colors.onSurface,
    border: theme.colors.outlineVariant,
  },
};

export const WORKOUT_TYPE_LABEL = {
  strength: 'Musculação',
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For Time',
} as const;

export const WORKOUT_TYPE_ICON = {
  strength: 'dumbbell',
  amrap: 'timer-sand',
  emom: 'timer-outline',
  for_time: 'flag-checkered',
} as const;
