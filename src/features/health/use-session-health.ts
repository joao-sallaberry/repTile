import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useRef } from 'react';

import { db } from '@/db/client';
import { sessionHealth } from '@/db/schema';

import { autoLinkSessions } from './repo';

/**
 * The session's Health Connect link (undefined while loading or when there's none). On first render, a
 * finished session without one is matched automatically: Google Health syncs with a delay, so every visit
 * tries again until a record shows up, and re-reads a link saved before its heart rate arrived.
 */
export function useSessionHealth(sessionId: string, finished: boolean) {
  const { data, updatedAt } = useLiveQuery(
    db.query.sessionHealth.findFirst({
      where: and(eq(sessionHealth.sessionId, sessionId), isNull(sessionHealth.deletedAt)),
    }),
    [sessionId],
  );
  const loaded = updatedAt != null;
  const missing = loaded && (!data || (!data.unlinked && data.recordId != null && data.avgHr == null));
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!finished || !missing || tried.current === sessionId) return;
    tried.current = sessionId;
    autoLinkSessions([sessionId]).catch(() => {});
  }, [finished, missing, sessionId]);

  return data && !data.unlinked ? data : undefined;
}
