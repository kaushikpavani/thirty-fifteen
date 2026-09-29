import type { AuthUser, RideSummary } from '../types';
import { doneStats } from './rideStats';
import { insightStats } from './rideSummary';
import { clockText } from './rideView';
import type { Vo2Category, Vo2Estimate } from './vo2max';

/** The only fields the email actually needs — a saved WorkoutRecord satisfies this, but so does a ride that hasn't been persisted yet. */
export type EmailableRide = { endedAt: string; ftpWatts: number; completed: boolean };

/** The rider's fitness-profile VO2max estimate, if there's enough data for one. Not ride-specific — same value on every card until the profile or FTP changes. */
export type Vo2Section = { estimate: Vo2Estimate; category: Vo2Category | null } | null;

/**
 * One line of plain-language context for a stat that isn't self-explanatory.
 * Deliberately skips the obvious ones (avg/max heart rate, elapsed time) —
 * the user asked for this so the email teaches, not clutters.
 */
function statExplainer(label: string): string | null {
  switch (label) {
    case 'Hard avg':
      return 'Your average watts during the 30-second hard efforts.';
    case 'Easy avg':
      return 'Your average watts during the 15-second recovery spins.';
    case 'Work':
      return 'Total mechanical energy you produced, in kilojoules. Roughly comparable to calories burned pedaling.';
    case 'In HARD':
      return 'Total time spent in hard efforts — no power meter was connected on this ride, so watts aren’t available.';
    default:
      return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function rideEmailSubject(session: EmailableRide): string {
  return `Your 30/15 ride — ${formatDate(session.endedAt)}`;
}

/**
 * Self-contained HTML email body. Plain tables, no external assets or
 * scripts — the widest possible compatibility across mail clients, and
 * nothing that depends on a server to render.
 */
export function rideEmailHtml(session: EmailableRide, summary: RideSummary, vo2: Vo2Section = null): string {
  const stats = doneStats(summary);
  const insights = insightStats(summary);
  const repWatts = summary.repWatts ?? [];
  const repBpm = summary.repBpm ?? [];
  const hasReps = repWatts.length > 0;

  const statRows = stats
    .map((s) => {
      const explain = statExplainer(s.label);
      return `
        <tr>
          <td style="padding:8px 0;color:#F5F5F2;font-size:15px;font-weight:600;">${escapeHtml(s.label)}</td>
          <td style="padding:8px 0;color:#F5F5F2;font-size:15px;text-align:right;">${escapeHtml(s.value)}${s.unit ? ` <span style="color:#9B9BA1;">${escapeHtml(s.unit)}</span>` : ''}</td>
        </tr>
        ${explain ? `<tr><td colspan="2" style="padding:0 0 10px;color:#9B9BA1;font-size:12px;line-height:16px;">${escapeHtml(explain)}</td></tr>` : ''}`;
    })
    .join('');

  const insightRows = insights
    .map(
      (s) => `
        <tr>
          <td colspan="2" style="padding:12px 0 0;">
            <div style="color:#F5F5F2;font-size:15px;font-weight:600;">${escapeHtml(s.label)}: ${escapeHtml(s.value)} ${escapeHtml(s.unit)}</div>
            <div style="color:#9B9BA1;font-size:12px;line-height:16px;margin-top:2px;">${escapeHtml(s.explain)}</div>
          </td>
        </tr>`,
    )
    .join('');

  const repTable = hasReps
    ? `
      <h3 style="color:#F5F5F2;font-size:15px;margin:24px 0 10px;">Rep by rep</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#9B9BA1;font-size:12px;">Rep</td>
          <td style="padding:4px 0;color:#9B9BA1;font-size:12px;text-align:right;">Watts</td>
          ${repBpm.length ? '<td style="padding:4px 0;color:#9B9BA1;font-size:12px;text-align:right;">Heart rate</td>' : ''}
        </tr>
        ${repWatts
          .map(
            (w, i) => `
          <tr>
            <td style="padding:3px 0;color:#F5F5F2;font-size:13px;">${i + 1}</td>
            <td style="padding:3px 0;color:#F5F5F2;font-size:13px;text-align:right;">${Math.round(w)} W</td>
            ${repBpm.length ? `<td style="padding:3px 0;color:#F5F5F2;font-size:13px;text-align:right;">${repBpm[i] != null ? `${Math.round(repBpm[i]!)} bpm` : '—'}</td>` : ''}
          </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const vo2Block = vo2
    ? `
      <h3 style="color:#F5F5F2;font-size:15px;margin:24px 0 10px;">Fitness</h3>
      <div style="background:rgba(92,200,230,0.1);border-radius:12px;padding:14px 16px;">
        <div style="color:#F5F5F2;font-size:22px;font-weight:700;">${vo2.estimate.value.toFixed(1)} <span style="color:#9B9BA1;font-size:13px;font-weight:400;">ml/kg/min VO₂max${vo2.category ? ` · ${escapeHtml(vo2.category)}` : ''}</span></div>
        <div style="color:#9B9BA1;font-size:12px;line-height:16px;margin-top:6px;">
          Likely between ${vo2.estimate.low.toFixed(1)} and ${vo2.estimate.high.toFixed(1)} — a field estimate from your FTP and heart rate, not a lab measurement.
        </div>
      </div>`
    : '';

  return `
  <div style="background:#000000;padding:24px 16px;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;">
      <div style="color:#FF6A2B;font-size:13px;font-weight:600;letter-spacing:1px;">30/15</div>
      <h1 style="color:#F5F5F2;font-size:26px;margin:8px 0 4px;">${escapeHtml(formatDate(session.endedAt))}</h1>
      <div style="color:#9B9BA1;font-size:15px;margin-bottom:20px;">
        ${session.completed ? 'Finished' : 'Ended early'} · FTP ${session.ftpWatts} W · ${escapeHtml(clockText(summary.durationMs))}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
        ${statRows}
      </table>
      ${
        insights.length
          ? `<h3 style="color:#F5F5F2;font-size:15px;margin:24px 0 0;">Efficiency & recovery</h3>
             <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${insightRows}</table>`
          : ''
      }
      ${repTable}
      ${vo2Block}
      <div style="color:#5A5A5F;font-size:12px;margin-top:28px;">Sent from 30/15. Forever free — no account required to ride.</div>
    </div>
  </div>`;
}

/**
 * Opens the device's own mail composer, pre-filled and ready to send —
 * nothing leaves the phone until the rider hits send themselves, so this
 * needs no backend of ours and no third-party email service.
 */
export async function emailRideSummary(input: {
  session: EmailableRide;
  summary: RideSummary;
  user: AuthUser;
  vo2?: Vo2Section;
}): Promise<void> {
  const MailComposer = await import('expo-mail-composer');
  const available = await MailComposer.isAvailableAsync();
  if (!available) return;
  await MailComposer.composeAsync({
    recipients: input.user.email ? [input.user.email] : [],
    subject: rideEmailSubject(input.session),
    body: rideEmailHtml(input.session, input.summary, input.vo2 ?? null),
    isHtml: true,
  });
}
