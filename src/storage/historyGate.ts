/**
 * Whether a finished session may be copied to the cloud.
 * Signed-out rides and rides already covered by a local wipe stay on the phone.
 */
export function shouldUploadSession(
  configured: boolean,
  userId: string | null,
  endedAt: string,
  deletedThrough: string | null,
): boolean {
  if (!configured || !userId) return false;
  if (deletedThrough != null && endedAt <= deletedThrough) return false;
  return true;
}
