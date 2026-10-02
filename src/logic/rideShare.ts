import type { RideSummary } from '../types';
import { rideBadges, rideCardHtml } from './rideCard';
import { rideEmailSubject, type EmailableRide, type Vo2Section } from './rideEmail';
import { standing } from './vo2Standing';

export type ShareResult = 'shared' | 'unavailable' | 'cancelled';

export type ShareRideInput = {
  session: EmailableRide & { hardWatts?: number | null };
  summary: RideSummary;
  vo2?: Vo2Section;
  riderName?: string | null;
  /** For "Fitter than X% of …" on the card. */
  ageYears?: number | null;
  sex?: 'male' | 'female' | null;
  repsPerSet?: number | null;
  /** The rider's rides, to spot personal bests. */
  sessions?: readonly { summary?: RideSummary | null }[];
};

/** Everything the card needs, derived from what the screens already have. */
export function rideCardInputFor(input: ShareRideInput) {
  const reps = input.summary.repWatts?.length ?? 0;
  const sets = Math.max(1, input.summary.setsDone);
  const inferred = reps > 0 && reps % sets === 0 ? reps / sets : null;
  const est = input.vo2?.estimate ?? null;
  return {
    endedAt: input.session.endedAt,
    ftpWatts: input.session.ftpWatts,
    completed: input.session.completed,
    hardTarget: input.session.hardWatts ?? null,
    repsPerSet: input.repsPerSet ?? inferred,
    summary: input.summary,
    riderName: input.riderName ?? null,
    vo2: est ? { estimate: est } : null,
    standing: est && input.ageYears != null && input.sex ? standing(est.value, input.ageYears, input.sex) : null,
    badges: rideBadges(input.summary, input.sessions ?? []),
  };
}

/**
 * Draws the ride card, prints it to a single-page PDF sized to the card, and
 * hands it to the OS share sheet: WhatsApp, Gmail, Messages, AirDrop, Files,
 * whatever is on the phone. Built and shared entirely on-device.
 */
export async function shareRidePdf(input: ShareRideInput): Promise<ShareResult> {
  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) return 'unavailable';

  const Print = await import('expo-print');
  const card = rideCardHtml(rideCardInputFor(input));
  const { uri } = await Print.printToFileAsync({
    html: card.html,
    width: card.width,
    height: card.height,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: rideEmailSubject(input.session),
  });
  return 'shared';
}
