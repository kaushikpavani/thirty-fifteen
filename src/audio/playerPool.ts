/**
 * A small pool of audio players for the coach's clips.
 *
 * iOS only allows so many audio players to exist at once. Loading every clip
 * a ride might use up front (about sixty, with takes) went past that on a real
 * iPhone, and because loading was all-or-nothing, one refusal left the coach
 * with no recordings at all and every line fell back to the phone's own voice.
 *
 * So: players are made when a clip is first needed and the least recently used
 * are released to stay under a cap. The count-in and "Go" are pinned, because
 * they have to land exactly on time. A clip that fails to load affects only
 * itself.
 *
 * Pure over an injected `create`, so the behaviour is tested without a phone.
 */
export type PoolPlayer = { remove: () => void };

export function createPlayerPool<P extends PoolPlayer>(options: { create: (source: number) => P; max: number }) {
  const players = new Map<string, P>(); // insertion order = least recently used first
  const pinned = new Set<string>();
  let lastError: string | null = null;

  function evict(): void {
    for (const key of players.keys()) {
      if (players.size <= options.max) return;
      if (pinned.has(key)) continue;
      const player = players.get(key)!;
      players.delete(key);
      try {
        player.remove();
      } catch {
        // already gone
      }
    }
  }

  /** The player for this clip, made now if needed. `fresh` is true when it was just created. */
  function get(key: string, source: number, pin = false): { player: P; fresh: boolean } | null {
    const existing = players.get(key);
    if (existing) {
      players.delete(key);
      players.set(key, existing); // now the most recently used
      if (pin) pinned.add(key);
      return { player: existing, fresh: false };
    }
    try {
      const player = options.create(source);
      players.set(key, player);
      if (pin) pinned.add(key);
      evict();
      return { player, fresh: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  function clear(): void {
    for (const player of players.values()) {
      try {
        player.remove();
      } catch {
        // already gone
      }
    }
    players.clear();
    pinned.clear();
  }

  return {
    get,
    clear,
    all: () => [...players.values()],
    size: () => players.size,
    lastError: () => lastError,
  };
}
