export const FEEDBACK_MAX = 2000;

/** Free-form note. Empty and oversized notes are not feedback. */
export function normalizeFeedback(raw: string): string | null {
  const body = raw.trim();
  if (!body || body.length > FEEDBACK_MAX) return null;
  return body;
}
