const MORNING = [
  'The KOM is still asleep.',
  'Quiet roads. Loud legs.',
  'First session sets the day.',
];

const AFTERNOON = [
  'The hour is yours.',
  'Everyone else is sitting.',
  'Send it before the inbox does.',
];

const EVENING = [
  'One more session between you and the rest.',
  'Lights on. No excuses left.',
  'The KOM doesn’t take evenings off.',
];

const NIGHT = [
  'Late. The numbers still count.',
  'Dark outside. Bright on the pedals.',
];

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Still up';
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function poolFor(date: Date): string[] {
  const hour = date.getHours();
  if (hour < 5) return NIGHT;
  if (hour < 12) return MORNING;
  if (hour < 17) return AFTERNOON;
  if (hour < 21) return EVENING;
  return NIGHT;
}

/** One line. Streak wins once it exists. Otherwise the line rotates by day inside the time-of-day pool. */
export function motivationLine(date: Date, streak: number): string {
  if (streak >= 7) return `${streak} days. The KOM is nervous.`;
  if (streak >= 3) return `${streak} days straight. Don’t blink.`;
  if (streak === 2) return 'Two days. The habit is the weapon.';
  const pool = poolFor(date);
  return pool[dayOfYear(date) % pool.length];
}
