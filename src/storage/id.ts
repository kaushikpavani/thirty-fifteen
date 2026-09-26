/** Install and row ids. UUIDs when the runtime has them; otherwise a short unguessable token. */

export function createId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Matches `devices.id` in the 30/15 Supabase migration. */
export function isInstallId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}
