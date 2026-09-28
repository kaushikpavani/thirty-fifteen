export type SavedHeartRate = {
  id: string;
  name: string;
};

export function parseSavedHeartRate(raw: string | null | undefined): SavedHeartRate | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; name?: unknown };
    if (typeof parsed.id !== 'string') return null;
    const id = parsed.id.trim();
    if (!id) return null;
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Heart rate';
    return { id, name };
  } catch {
    return null;
  }
}
