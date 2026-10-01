/**
 * The email the owner gets when a rider leaves a note. Pure (no Deno or
 * Node APIs) so it's unit-tested with the app's tests. The owner's address
 * never appears here: it comes from a server-side secret at send time.
 */

export type FeedbackRow = {
  id?: string | null;
  body?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  rider_name?: string | null;
  platform?: string | null;
  app_version?: string | null;
  device_id?: string | null;
};

export type FeedbackEmail = { subject: string; text: string; html: string; replyTo: string | null };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One line, no newlines, so a note can't inject extra headers into the subject. */
function subjectPreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 57)}…` : flat;
}

export function buildFeedbackEmail(row: FeedbackRow, riderEmail: string | null): FeedbackEmail | null {
  const body = (row.body ?? '').trim();
  if (!body) return null;
  const who = row.rider_name?.trim() || (row.user_id ? 'A signed-in rider' : 'An anonymous rider');
  const when = row.created_at ? new Date(row.created_at).toUTCString() : 'just now';
  const details: [string, string][] = [
    ['From', riderEmail ? `${who} <${riderEmail}>` : `${who}${row.user_id ? '' : ' (not signed in)'}`],
    ['When', when],
    ['App', [row.platform, row.app_version].filter(Boolean).join(' · ') || 'unknown'],
    ['Note id', row.id ?? 'unknown'],
  ];
  const text = [
    body,
    '',
    '—',
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    riderEmail ? 'Reply to this email to answer the rider directly.' : 'This rider wasn’t signed in, so there’s no address to reply to.',
  ].join('\n');
  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px">
  <p style="font-size:16px;line-height:1.5;white-space:pre-wrap;margin:0 0 20px">${escapeHtml(body)}</p>
  <table style="font-size:13px;color:#555;border-top:1px solid #ddd;padding-top:10px">
    ${details.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#888">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
  </table>
  <p style="font-size:12px;color:#888;margin-top:16px">${
    riderEmail ? 'Reply to this email to answer the rider directly.' : 'This rider wasn’t signed in, so there’s no address to reply to.'
  }</p>
</div>`;
  return { subject: `30/15 note: ${subjectPreview(body)}`, text, html, replyTo: riderEmail };
}
