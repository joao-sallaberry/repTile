import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { db } from '@/db/client';
import { sessionBlocks } from '@/db/schema';
import { finishBlock } from '@/features/session/repo';
import { WodRunner } from '@/features/session/wod-runner';
import { describeBlockFormat } from '@/features/workouts/blocks';

/** Full-screen timer for one WOD block of the session in progress. */
export default function WodBlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: block } = useLiveQuery(db.query.sessionBlocks.findFirst({ where: eq(sessionBlocks.id, id) }), [id]);
  if (!block) return null;
  return (
    <>
      <Stack.Screen options={{ title: describeBlockFormat(block) ?? 'WOD' }} />
      <WodRunner
        block={block}
        onSave={async (result) => {
          await finishBlock(block.id, result);
          router.back();
        }}
      />
    </>
  );
}
