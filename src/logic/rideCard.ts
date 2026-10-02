/**
 * The shareable ride card: one tall page, drawn entirely as SVG.
 *
 * Why SVG and not styled HTML: when iOS prints HTML to PDF it drops CSS
 * backgrounds, which turned the old dark card into pale text on white
 * paper. Everything here, including the background, is vector content, so
 * the PDF looks exactly like the design on every device. The page height
 * follows the content, so it is always a single page.
 *
 * Pure: no React Native or Expo imports, so the layout is unit-tested and
 * can be rendered in a browser for design review.
 */
import type { RideSummary } from '../types';
import { clockText } from './rideView';
import { histogram, type Standing } from './vo2Standing';
import type { Vo2Estimate } from './vo2max';

export type RideCardInput = {
  endedAt: string;
  ftpWatts: number;
  completed: boolean;
  /** HARD target watts for this ride, when known. */
  hardTarget?: number | null;
  /** Reps per set, for the "2 × 13" line and the gap between sets in the chart. */
  repsPerSet?: number | null;
  summary: RideSummary;
  riderName?: string | null;
  vo2?: { estimate: Vo2Estimate } | null;
  standing?: Standing | null;
  /** Achievements this ride earned, e.g. "Best hard-rep average yet". */
  badges?: string[];
};

const W = 600;
const M = 20; // card margin
const P = 40; // text inset
const C = {
  bg: '#060607',
  surface: '#121214',
  text: '#F5F5F2',
  secondary: '#A0A0A6',
  tertiary: '#77777D',
  hairline: '#26262A',
  ember: '#FF5A1F',
  emberDeep: '#B8471F',
  glacier: '#5CC8E6',
  raised: '#2C2C2E',
};
const FONT = `-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type TextOpts = { size: number; weight?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number; opacity?: number };

function t(x: number, y: number, content: string, o: TextOpts): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.text}"${
    o.anchor ? ` text-anchor="${o.anchor}"` : ''
  }${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''}>${content}</text>`;
}

/** Number with a smaller, quieter unit after it. */
function valueUnit(value: string, unit: string, unitSize: number): string {
  return `${esc(value)}${unit ? `<tspan font-size="${unitSize}" font-weight="500" letter-spacing="0" fill="${C.secondary}"> ${esc(unit)}</tspan>` : ''}`;
}

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function card(y: number, h: number): string {
  return `<rect x="${M}" y="${y}" width="${W - 2 * M}" height="${h}" rx="24" fill="${C.surface}"/>`;
}

function roundedTopBar(x: number, y: number, w: number, base: number, r: number): string {
  const rr = Math.min(r, w / 2, Math.max(0, base - y));
  return `M${x.toFixed(1)},${base} L${x.toFixed(1)},${(y + rr).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + rr).toFixed(1)},${y.toFixed(1)} L${(x + w - rr).toFixed(1)},${y.toFixed(1)} Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + rr).toFixed(1)} L${(x + w).toFixed(1)},${base} Z`;
}

function firstName(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (!first || first.includes('@')) return null;
  return first.length > 14 ? null : first;
}

export function rideCardSvg(input: RideCardInput): { svg: string; width: number; height: number } {
  const s = input.summary;
  const out: string[] = [];
  let y = 0;

  // ——— Header ———
  const date = new Date(input.endedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  out.push(
    `<text x="${P}" y="62" font-size="26" font-weight="800" fill="${C.text}" letter-spacing="-0.5">30<tspan fill="${C.ember}">/</tspan>15</text>`,
    t(W - P, 60, esc(date), { size: 14, fill: C.secondary, anchor: 'end' }),
  );

  // ——— Title ———
  const complete = s.setsDone >= s.setsPlanned && input.completed;
  const reps = input.repsPerSet ? ` × ${input.repsPerSet}` : s.setsDone === 1 ? ' SET' : ' SETS';
  const kicker = complete ? `${s.setsDone}${reps} COMPLETE` : `${s.setsDone} OF ${s.setsPlanned} SETS · ENDED EARLY`;
  const who = firstName(input.riderName);
  out.push(
    t(P, 124, esc(kicker), { size: 13, weight: 700, fill: C.ember, spacing: 1.6 }),
    t(P, 168, esc(who ? `${who}’s ride` : complete ? 'Ride complete' : '30/15 ride'), { size: 40, weight: 800, spacing: -1 }),
    t(P, 194, esc(`${clockText(s.durationMs)} · FTP ${input.ftpWatts} W`), { size: 15, fill: C.secondary }),
  );

  // ——— Hero ———
  const hasPower = s.avgHardWatts != null;
  out.push(t(P, 246, hasPower ? 'HARD-REP AVERAGE' : 'TIME IN HARD', { size: 12, weight: 700, fill: C.tertiary, spacing: 1.4 }));
  out.push(
    `<text x="${P - 4}" y="338" font-size="104" font-weight="800" fill="${C.text}" letter-spacing="-4">${
      hasPower ? valueUnit(String(s.avgHardWatts), 'W', 32) : esc(clockText(s.hardMs))
    }</text>`,
  );
  const side: [string, string][] = [];
  if (hasPower) side.push([clockText(s.hardMs), 'in HARD']);
  if (s.workKj != null) side.push([`${s.workKj} kJ`, 'work done']);
  if (!hasPower && s.avgBpm != null) side.push([`${s.avgBpm} bpm`, 'avg heart rate']);
  side.slice(0, 2).forEach(([v, label], i) => {
    out.push(
      t(W - P, 282 + i * 52, esc(v), { size: 26, weight: 700, anchor: 'end' }),
      t(W - P, 300 + i * 52, esc(label), { size: 12, fill: C.secondary, anchor: 'end' }),
    );
  });
  y = 362;
  if (hasPower && input.hardTarget) {
    const pct = Math.round((s.avgHardWatts! / input.hardTarget) * 100);
    out.push(t(P, y, esc(`${pct}% of your ${input.hardTarget} W target`), { size: 14, fill: C.secondary }));
    y += 22;
  }

  // ——— Achievements ———
  const badges = (input.badges ?? []).slice(0, 3);
  if (badges.length) {
    let bx = P;
    let by = y + 6;
    for (const badge of badges) {
      const bw = Math.round(badge.length * 6.9 + 44);
      if (bx + bw > W - P) {
        bx = P;
        by += 38;
      }
      out.push(
        `<rect x="${bx}" y="${by}" width="${bw}" height="30" rx="15" fill="${C.ember}" opacity="0.16"/>`,
        `<path transform="translate(${bx + 12},${by + 7})" d="M8 0l2.3 5 5.4.6-4 3.7 1.1 5.4L8 12l-4.8 2.7 1.1-5.4-4-3.7 5.4-.6z" fill="${C.ember}"/>`,
        t(bx + 34, by + 20, esc(badge), { size: 13, weight: 600, fill: '#FF8A55' }),
      );
      bx += bw + 8;
    }
    y = by + 30 + 8;
  }
  y += 12;

  // ——— Every hard rep ———
  const repW = s.repWatts ?? [];
  const repB = s.repBpm ?? [];
  if (repW.length > 0) {
    const hasHr = repB.length >= 2;
    const chartH = 132;
    const h = 58 + chartH + 30 + (hasHr ? 78 : 0);
    out.push(card(y, h));
    out.push(t(P, y + 34, 'Every hard rep', { size: 16, weight: 700 }));
    const target = input.hardTarget ?? null;
    if (target) {
      out.push(
        `<line x1="${W - P - 104}" x2="${W - P - 88}" y1="${y + 29}" y2="${y + 29}" stroke="${C.secondary}" stroke-width="2" stroke-dasharray="4 3"/>`,
        t(W - P, y + 34, esc(`Target ${target} W`), { size: 12, fill: C.secondary, anchor: 'end' }),
      );
    }
    const x0 = P;
    const cw = W - 2 * P;
    const perSet = Math.max(1, input.repsPerSet ?? repW.length);
    const sets = Math.ceil(repW.length / perSet);
    const setGap = 12;
    const gap = repW.length > 30 ? 2 : 3;
    const bw = (cw - (sets - 1) * setGap - (repW.length - 1) * gap) / repW.length;
    const xs = repW.map((_, i) => x0 + i * (bw + gap) + Math.floor(i / perSet) * setGap);
    const lo = Math.min(target ?? Infinity, ...repW) * 0.55;
    const hi = Math.max(target ?? 0, ...repW);
    const top = y + 58;
    const base = top + chartH;
    const yy = (w: number) => base - Math.max(6, ((w - lo) / Math.max(1, hi - lo)) * (chartH - 16));
    const strong: string[] = [];
    const weak: string[] = [];
    repW.forEach((w, i) => (target == null || w >= target ? strong : weak).push(roundedTopBar(xs[i]!, yy(w), bw, base, 4)));
    out.push(`<path d="${strong.join(' ')}" fill="url(#rcEmber)"/>`);
    if (weak.length) out.push(`<path d="${weak.join(' ')}" fill="${C.emberDeep}"/>`);
    if (target) {
      out.push(
        `<line x1="${x0 - 6}" x2="${x0 + cw + 6}" y1="${yy(target).toFixed(1)}" y2="${yy(target).toFixed(1)}" stroke="${C.text}" stroke-opacity="0.8" stroke-width="1.5" stroke-dasharray="5 4"/>`,
      );
    }
    const best = repW.indexOf(Math.max(...repW));
    out.push(t(xs[best]! + bw / 2, yy(repW[best]!) - 6, String(Math.round(repW[best]!)), { size: 11, weight: 700, anchor: 'middle' }));
    out.push(
      t(x0, base + 18, 'Rep 1', { size: 11, fill: C.tertiary }),
      t(x0 + cw, base + 18, esc(`Rep ${repW.length}`), { size: 11, fill: C.tertiary, anchor: 'end' }),
    );
    if (hasHr) {
      const n = Math.min(repB.length, repW.length);
      const hrTop = base + 50;
      const hrH = 36;
      const bLo = Math.min(...repB.slice(0, n));
      const bHi = Math.max(...repB.slice(0, n));
      const hy = (b: number) => hrTop + hrH - ((b - bLo) / Math.max(1, bHi - bLo)) * hrH;
      const pts = repB.slice(0, n).map((b, i) => `${(xs[i]! + bw / 2).toFixed(1)},${hy(b).toFixed(1)}`);
      out.push(
        `<circle cx="${x0 + 4}" cy="${base + 36}" r="4" fill="${C.glacier}"/>`,
        t(x0 + 14, base + 40, 'Heart rate on each rep', { size: 12, fill: C.secondary }),
        t(x0 + cw, base + 40, esc(`${Math.round(bLo)}–${Math.round(bHi)} bpm`), { size: 12, fill: C.secondary, anchor: 'end' }),
        `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.glacier}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }
    y += h + 12;
  }

  // ——— Numbers ———
  const stats: [string, string, string][] = [];
  if (s.avgEasyWatts != null) stats.push(['Easy-rep average', String(s.avgEasyWatts), 'W']);
  if (s.peakWatts != null) stats.push(['Peak power', String(s.peakWatts), 'W']);
  if (repW.length) stats.push(['Best rep', String(Math.round(Math.max(...repW))), 'W']);
  if (s.avgBpm != null) stats.push(['Average heart rate', String(s.avgBpm), 'bpm']);
  if (s.maxBpm != null) stats.push(['Max heart rate', String(s.maxBpm), 'bpm']);
  if (hasPower || stats.length % 3 !== 0) stats.push(['Time in EASY', clockText(s.easyMs), '']);
  const shown = stats.slice(0, stats.length >= 6 ? 6 : 3);
  if (shown.length >= 3) {
    const rows = shown.length / 3;
    const h = 28 + rows * 64;
    out.push(card(y, h));
    const colW = (W - 2 * P) / 3;
    shown.forEach(([label, value, unit], i) => {
      const cx = P + (i % 3) * colW;
      const cy = y + 40 + Math.floor(i / 3) * 64;
      out.push(
        t(cx, cy, esc(label), { size: 12, fill: C.secondary }),
        `<text x="${cx}" y="${cy + 30}" font-size="26" font-weight="700" fill="${C.text}" letter-spacing="-0.5">${valueUnit(value, unit, 13)}</text>`,
      );
    });
    y += h + 12;
  }

  // ——— Efficiency ———
  const insights: [string, string, string, string][] = [];
  if (s.efficiencyFactor != null) {
    insights.push(['Efficiency factor', s.efficiencyFactor.toFixed(2), 'W/bpm', 'Hard-rep watts per heartbeat. It climbs as your aerobic engine gets fitter.']);
  }
  if (s.decouplingPct != null) {
    const sign = s.decouplingPct > 0 ? '+' : '';
    insights.push([
      'HR:Power drift',
      `${sign}${s.decouplingPct.toFixed(1)}`,
      '%',
      s.decouplingPct <= 5 ? 'How much power per heartbeat faded by the last reps. Under 5% is a well-paced ride.' : 'How much power per heartbeat faded by the last reps. Over 5% means fatigue caught up late.',
    ]);
  }
  if (insights.length) {
    const h = 150;
    out.push(card(y, h));
    const colW = (W - 2 * P) / insights.length;
    insights.forEach(([label, value, unit, caption], i) => {
      const cx = P + i * colW;
      out.push(
        t(cx, y + 36, esc(label), { size: 12, fill: C.secondary }),
        `<text x="${cx}" y="${y + 72}" font-size="32" font-weight="700" fill="${C.text}" letter-spacing="-0.8">${valueUnit(value, unit, 14)}</text>`,
      );
      wrap(caption, insights.length === 1 ? 70 : 36).forEach((line, li) => {
        out.push(t(cx, y + 96 + li * 16, esc(line), { size: 12, fill: C.tertiary }));
      });
    });
    y += h + 12;
  }

  // ——— Fitness ———
  if (input.vo2) {
    const est = input.vo2.estimate;
    const st = input.standing ?? null;
    const h = st ? 250 : 112;
    out.push(card(y, h));
    out.push(
      t(P, y + 36, 'ESTIMATED VO₂MAX', { size: 12, weight: 700, fill: C.tertiary, spacing: 1.4 }),
      `<text x="${P}" y="${y + 84}" font-size="44" font-weight="800" fill="${C.text}" letter-spacing="-1.2">${valueUnit(est.value.toFixed(1), 'ml/kg/min', 14)}</text>`,
    );
    if (st) {
      out.push(
        t(W - P, y + 62, esc(`Fitter than ${st.percentile}%`), { size: 22, weight: 800, anchor: 'end' }),
        t(W - P, y + 82, esc(`of ${st.group}`), { size: 13, fill: C.secondary, anchor: 'end' }),
      );
      const dist = histogram(st.band);
      const x0 = P;
      const cw = W - 2 * P;
      const top = y + 122;
      const hh = 92;
      const base = top + hh;
      const span = dist.max - dist.min;
      const xx = (v: number) => x0 + ((Math.min(dist.max, Math.max(dist.min, v)) - dist.min) / span) * cw;
      const peak = Math.max(...dist.bins.map((b) => b.share));
      const bars = dist.bins.map((b) => roundedTopBar(xx(b.x0) + 1, base - (b.share / peak) * hh, Math.max(1, xx(b.x1) - xx(b.x0) - 2), base, 3)).join(' ');
      const you = xx(est.value);
      const clipId = 'rcPassed';
      out.push(
        `<clipPath id="${clipId}"><rect x="${x0}" y="${top - 30}" width="${(you - x0).toFixed(1)}" height="${hh + 40}"/></clipPath>`,
        `<path d="${bars}" fill="${C.raised}"/>`,
        `<path d="${bars}" fill="url(#rcGlacier)" clip-path="url(#${clipId})"/>`,
        `<line x1="${xx(st.median).toFixed(1)}" x2="${xx(st.median).toFixed(1)}" y1="${top - 4}" y2="${base}" stroke="${C.secondary}" stroke-width="1" stroke-dasharray="3 4"/>`,
        `<line x1="${you.toFixed(1)}" x2="${you.toFixed(1)}" y1="${top - 10}" y2="${base}" stroke="${C.ember}" stroke-width="2.5"/>`,
        `<circle cx="${you.toFixed(1)}" cy="${base}" r="5.5" fill="${C.ember}" stroke="${C.surface}" stroke-width="2"/>`,
      );
      const lw = 46;
      const lx = Math.min(Math.max(x0, you - lw / 2), x0 + cw - lw);
      out.push(
        `<rect x="${lx.toFixed(1)}" y="${top - 30}" width="${lw}" height="20" rx="10" fill="${C.ember}"/>`,
        t(lx + lw / 2, top - 16, 'You', { size: 12, weight: 800, fill: '#000000', anchor: 'middle' }),
        t(xx(st.median), base + 16, esc(`Median ${st.median.toFixed(1)}`), { size: 11, fill: C.tertiary, anchor: 'middle' }),
      );
    } else {
      out.push(t(W - P, y + 80, esc(`Likely ${est.low.toFixed(1)}–${est.high.toFixed(1)}`), { size: 13, fill: C.secondary, anchor: 'end' }));
    }
    y += h + 12;
  }

  // ——— Footer ———
  y += 14;
  out.push(
    `<text x="${P}" y="${y + 6}" font-size="15" font-weight="800" fill="${C.text}">30<tspan fill="${C.ember}">/</tspan>15</text>`,
    t(P + 50, y + 6, 'Micro-intervals that build your engine', { size: 12, fill: C.secondary }),
    t(W - P, y + 6, 'Free. Forever.', { size: 12, fill: C.tertiary, anchor: 'end' }),
  );
  if (input.vo2) {
    y += 22;
    out.push(
      t(P, y + 6, 'VO₂max is an estimate, not a lab test. Comparison: FRIEND registry, Mayo Clinic Proceedings, 2022.', { size: 10, fill: C.tertiary }),
    );
  }
  const height = Math.ceil(y + 34);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="${FONT}">
<defs>
  <radialGradient id="rcBloomA" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${C.ember}" stop-opacity="0.42"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/></radialGradient>
  <radialGradient id="rcBloomB" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${C.glacier}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.glacier}" stop-opacity="0"/></radialGradient>
  <linearGradient id="rcEmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A3D"/><stop offset="1" stop-color="#F2440E"/></linearGradient>
  <linearGradient id="rcGlacier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.glacier}"/><stop offset="1" stop-color="${C.glacier}" stop-opacity="0.55"/></linearGradient>
</defs>
<rect width="${W}" height="${height}" fill="${C.bg}"/>
<ellipse cx="130" cy="60" rx="330" ry="300" fill="url(#rcBloomA)"/>
<ellipse cx="560" cy="110" rx="280" ry="250" fill="url(#rcBloomB)"/>
${out.join('\n')}
</svg>`;
  return { svg, width: W, height };
}

/** The page handed to the PDF printer: the card, edge to edge, nothing else. */
export function rideCardHtml(input: RideCardInput): { html: string; width: number; height: number } {
  const { svg, width, height } = rideCardSvg(input);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width}, initial-scale=1">
<style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0;padding:0;background:${C.bg};-webkit-print-color-adjust:exact;print-color-adjust:exact}svg{display:block;width:${width}px;height:${height}px}</style>
</head><body>${svg}</body></html>`;
  return { html, width, height };
}

/** Achievements for a ride against the rider's other rides. Needs at least one earlier ride to compare with. */
export function rideBadges(summary: RideSummary, others: readonly { summary?: RideSummary | null }[]): string[] {
  // The ride itself may already be in the list as a saved copy; don't let it compete with itself.
  const same = (x: RideSummary) =>
    x === summary ||
    (x.durationMs === summary.durationMs && x.hardMs === summary.hardMs && x.avgHardWatts === summary.avgHardWatts && x.workKj === summary.workKj);
  const prior = others.map((o) => o.summary).filter((x): x is RideSummary => !!x && !same(x));
  if (prior.length === 0) return [];
  const out: string[] = [];
  const beats = (mine: number | null | undefined, pick: (r: RideSummary) => number | null | undefined) => {
    if (mine == null) return false;
    const rest = prior.map(pick).filter((v): v is number => v != null);
    return rest.length > 0 && mine > Math.max(...rest);
  };
  if (beats(summary.avgHardWatts, (r) => r.avgHardWatts)) out.push('Best hard-rep average yet');
  const myBest = summary.repWatts?.length ? Math.max(...summary.repWatts) : null;
  if (beats(myBest, (r) => (r.repWatts?.length ? Math.max(...r.repWatts) : null))) out.push('Best single rep yet');
  if (beats(summary.efficiencyFactor, (r) => r.efficiencyFactor)) out.push('Best efficiency yet');
  if (beats(summary.workKj, (r) => r.workKj)) out.push('Most work in one ride');
  return out;
}
