import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { db } from '@/db/client';
import { sessionBlocks, sessions } from '@/db/schema';
import { finishBlock } from '@/features/session/repo';
import { WodRunner } from '@/features/session/wod-runner';

/** Full-screen timer for one WOD block of the session in progress (draws its own header). */
export default function WodBlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: block } = useLiveQuery(db.query.sessionBlocks.findFirst({ where: eq(sessionBlocks.id, id) }), [id]);
  const sessionId = block?.sessionId ?? '';
  const { data: session } = useLiveQuery(db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) }), [sessionId]);
  const { data: siblings } = useLiveQuery(
    db
      .select({ id: sessionBlocks.id, position: sessionBlocks.position })
      .from(sessionBlocks)
      .where(and(eq(sessionBlocks.sessionId, sessionId), isNull(sessionBlocks.deletedAt))),
    [sessionId],
  );
  if (!block) return null;

  const ordered = [...siblings].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((b) => b.id === block.id);
  const subtitle = [session?.name, ordered.length > 1 && index >= 0 ? `bloco ${index + 1} de ${ordered.length}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <WodRunner
        block={block}
        subtitle={subtitle}
        onClose={() => router.back()}
        onSave={async (result) => {
          await finishBlock(block.id, result);
          router.back();
        }}
      />
    </>
  );
}
