/**
 * When the Bluetooth radio may open.
 * First launch has no saved sensor and has not been asked, so the system
 * permission sheet stays down. A later launch may restore a sensor the rider
 * already connected. Tapping Connect always may open the radio.
 */
export function shouldOpenRadio(input: { savedId: string | null | undefined; userAsked: boolean }): boolean {
  if (input.userAsked) return true;
  return typeof input.savedId === 'string' && input.savedId.length > 0;
}
