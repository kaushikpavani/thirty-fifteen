import type { CloudAttempt } from './deletionState';

/**
 * After a cloud-delete pass, decide whether outboxes and the profile may flush.
 * A finished account delete must not upload events or recreate the profile.
 */
export function shouldFlushOutboxes(account: CloudAttempt): boolean {
  return account !== 'done';
}
