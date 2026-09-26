import AsyncStorage from '@react-native-async-storage/async-storage';
import { markHistoryDeleted, parseDeletionState, type DeletionState } from './deletionState';

const KEY = '@thirtyfifteen/deletion/v1';

/** In-memory copy so a wipe is visible before AsyncStorage finishes. */
let memory: DeletionState | null = null;
let hydrated = false;

function freshEmpty(): DeletionState {
  return { jobs: [], historyDeletedThrough: null, sessionDeletesLeft: 0 };
}

/**
 * Publish a history wipe before any await. An in-flight merge reads this
 * and will not put those sessions back on screen.
 */
export function primeHistoryWipe(at: string): void {
  memory = markHistoryDeleted(memory ?? freshEmpty(), at);
}

export function peekDeletionState(): DeletionState | null {
  return memory;
}

async function readDisk(): Promise<DeletionState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return freshEmpty();
    return parseDeletionState(JSON.parse(raw) as unknown);
  } catch {
    return freshEmpty();
  }
}

export async function loadDeletionState(): Promise<DeletionState> {
  if (hydrated && memory) return memory;
  const disk = await readDisk();
  hydrated = true;
  const primedThrough = memory?.historyDeletedThrough ?? null;
  const jobs = [...disk.jobs];
  for (const job of memory?.jobs ?? []) {
    const index = jobs.findIndex((item) => item.kind === job.kind);
    if (index >= 0) jobs[index] = job;
    else jobs.unshift(job);
  }
  const folded: DeletionState = {
    jobs,
    historyDeletedThrough: disk.historyDeletedThrough,
    sessionDeletesLeft: disk.sessionDeletesLeft,
  };
  memory = primedThrough ? markHistoryDeleted(folded, primedThrough) : folded;
  return memory;
}

export async function saveDeletionState(next: DeletionState): Promise<void> {
  try {
    memory = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    memory = next;
  }
}
