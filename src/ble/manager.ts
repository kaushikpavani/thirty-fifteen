/**
 * One radio for power and heart rate. Two BleManager instances fight over the scan.
 * Refcount keeps the shared manager alive while either sensor client is open.
 */

type Destroyable = { destroy: () => void };

/** Lets iOS keep delivering watts and heart rate while another app is in front. */
const RESTORE_ID = 'thirtyfifteen-ble';

let managerPromise: Promise<Destroyable> | null = null;
let refs = 0;

export async function acquireBleManager<T extends Destroyable>(): Promise<T> {
  refs += 1;
  if (!managerPromise) {
    managerPromise = (async () => {
      const ble = (await import('react-native-ble-plx')) as {
        BleManager: new (options?: {
          restoreStateIdentifier?: string;
          restoreStateFunction?: (restoredState: unknown) => void;
        }) => Destroyable;
      };
      return new ble.BleManager({
        restoreStateIdentifier: RESTORE_ID,
        restoreStateFunction: () => {
          // The saved sensor id is what a later open reconnects. This callback
          // keeps Core Bluetooth allowed to restore the central in the background.
        },
      });
    })();
  }
  try {
    return (await managerPromise) as T;
  } catch (error) {
    refs = Math.max(0, refs - 1);
    if (refs === 0) managerPromise = null;
    throw error;
  }
}

export function releaseBleManager(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  const pending = managerPromise;
  void pending
    ?.then((created) => {
      if (refs > 0) return;
      managerPromise = null;
      try {
        created.destroy();
      } catch {
        // already gone
      }
    })
    .catch(() => {
      if (refs === 0) managerPromise = null;
    });
}
