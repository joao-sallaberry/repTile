import { Pressable, StyleSheet, Text } from 'react-native';

import type { SetType } from '@/db/schema';
import { SET_TYPE_LABEL } from '@/features/session/sets';

export const SET_TYPE_COLORS: Record<SetType, { fg: string; bg: string }> = {
  warmup: { fg: '#F5C451', bg: '#3A3016' },
  normal: { fg: '#E6E8EC', bg: '#24272E' },
  drop: { fg: '#9FDFFF', bg: '#0F3A4A' },
  failure: { fg: '#FFB4B4', bg: '#3A1C1C' },
};

const SHORT: Partial<Record<SetType, string>> = { warmup: 'W', drop: 'D', failure: 'F' };

/** The colored "W / 1 / D / F" badge of a set; pressable to change its type. */
export function SetBadge({ type, label, onPress }: { type: SetType; label?: string; onPress?: () => void }) {
  const c = SET_TYPE_COLORS[type];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Tipo da série: ${SET_TYPE_LABEL[type]}${onPress ? '. Toque para mudar' : ''}`}
      hitSlop={6}
      style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label ?? SHORT[type] ?? '1'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { width: 40, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '700' },
});
