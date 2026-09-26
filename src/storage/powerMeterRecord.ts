export type SavedPowerMeter = {
  id: string;
  name: string;
};

export function parseSavedPowerMeter(raw: string | null | undefined): SavedPowerMeter | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; name?: unknown };
    if (typeof parsed.id !== 'string') return null;
    const id = parsed.id.trim();
    if (!id) return null;
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Power meter';
    return { id, name };
  } catch {
    return null;
  }
}
