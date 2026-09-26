/** Development-build trail. Production stays quiet: no state, packets, or watts. */
export function bleLog(event: string, detail?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  if (detail === undefined) {
    console.log(`[cps] ${event}`);
    return;
  }
  console.log(`[cps] ${event}`, detail);
}
