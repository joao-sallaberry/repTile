import { and, desc, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';

import { db } from '@/db/client';
import { sessions, type Session } from '@/db/schema';
import { useLocations } from '@/features/places/queries';
import { formatDate, formatDuration } from '@/lib/format';

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

function groupByMonth(list: Session[]) {
  const groups: { title: string; data: Session[] }[] = [];
  for (const s of list) {
    // "outubro de 2026" -> "Outubro de 2026" (textTransform: capitalize would also capitalize "de").
    const month = monthFmt.format(new Date(s.startedAt));
    const title = month.charAt(0).toUpperCase() + month.slice(1);
    const last = groups.at(-1);
    if (last?.title === title) last.data.push(s);
    else groups.push({ title, data: [s] });
  }
  return groups;
}

export default function HistoryScreen() {
  const { data } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(isNull(sessions.deletedAt), isNotNull(sessions.finishedAt)))
      .orderBy(desc(sessions.startedAt)),
  );
  const locations = useLocations();
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Histórico" />
      </Appbar.Header>
      <SectionList
        sections={groupByMonth(data)}
        keyExtractor={(s) => s.id}
        renderSectionHeader={({ section }) => (
          <List.Subheader>{section.title}</List.Subheader>
        )}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={[
              formatDate(item.startedAt),
              item.finishedAt ? formatDuration((item.finishedAt - item.startedAt) / 1000) : null,
            ]
              .filter(Boolean)
              .join(' · ')
              .concat(`\n${(item.locationId && locationName.get(item.locationId)) || 'Sem local'}`)}
            descriptionNumberOfLines={2}
            left={(p) => <List.Icon {...p} icon="calendar-check" />}
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium">Nenhum treino registrado</Text>
            <Text variant="bodyMedium">Os treinos que você finalizar aparecem aqui.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
});
