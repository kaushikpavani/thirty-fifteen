/**
 * iOS copy stays byte-for-byte. Android (and every other platform) says
 * "phone" in the same sentence where iOS says "iPhone".
 */
export function deviceCopy(platform: string, ios: string): string {
  if (platform === 'ios') return ios;
  return ios.replaceAll('iPhone', 'phone');
}

export function silentRideNote(platform: string): string {
  if (platform === 'ios') return 'The iPhone silent switch never mutes a ride.';
  return 'Silent mode and vibrate never mute a ride.';
}

export function deleteAccountPhoneButton(platform: string): string {
  return deviceCopy(platform, 'Delete account and iPhone data');
}
