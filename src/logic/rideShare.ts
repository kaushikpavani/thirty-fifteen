import type { RideSummary } from '../types';
import { rideEmailHtml, rideEmailSubject, type EmailableRide, type Vo2Section } from './rideEmail';

export type ShareResult = 'shared' | 'unavailable' | 'cancelled';

/**
 * Renders the same ride card used for email into a PDF and hands it to the
 * OS share sheet — WhatsApp, Gmail, Messages, AirDrop, Files, whatever's on
 * the phone. Nothing is uploaded anywhere: the PDF is built and shared
 * entirely on-device via expo-print + expo-sharing.
 */
export async function shareRidePdf(input: { session: EmailableRide; summary: RideSummary; vo2?: Vo2Section }): Promise<ShareResult> {
  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) return 'unavailable';

  const Print = await import('expo-print');
  const html = rideEmailHtml(input.session, input.summary, input.vo2 ?? null);
  const { uri } = await Print.printToFileAsync({ html });

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: rideEmailSubject(input.session),
  });
  return 'shared';
}
