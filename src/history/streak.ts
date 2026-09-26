export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function completionStreak(
  sessions: { endedAt: string; completed: boolean }[],
  now = new Date(),
): number {
  const days = new Set<string>();
  for (const session of sessions) {
    if (!session.completed) continue;
    const when = new Date(session.endedAt);
    if (Number.isNaN(when.getTime())) continue;
    days.add(localDayKey(when));
  }

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
