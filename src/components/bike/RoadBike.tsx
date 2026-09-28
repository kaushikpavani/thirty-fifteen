import React, { useEffect, useId } from 'react';
import { Animated, Easing, Platform, View, type ViewStyle } from 'react-native';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const native = Platform.OS !== 'web';

/**
 * An original aero road bike, side view, facing right. Drawn in the language
 * of current race bikes: truncated-airfoil tubes, dropped seat stays, a
 * one-piece bar and stem, hidden cables, deep carbon rims and disc rotors.
 * No brand, no copied frame. 300 × 180 grid; wheels and cranks are their own
 * layers so they turn on the native thread.
 */
const VB = { w: 300, h: 180 };
const REAR = { x: 68, y: 124 };
const FRONT = { x: 234, y: 124 };
const BB = { x: 138, y: 129 };
const WHEEL_R = 51;

type Pt = { x: number; y: number };

export type BikeTone = {
  frame: string;
  frameEnd: string;
  carbon: string;
  accent: string;
  tire: string;
  rim: string;
  metal: string;
};

export const BIKE_TONES = {
  ember: { frame: '#FF6A2B', frameEnd: '#B8300A', carbon: '#141416', accent: '#5CC8E6', tire: '#0B0B0C', rim: '#1A1A1D', metal: '#9EA3AB' },
  line: { frame: '#FFFFFF', frameEnd: '#FFFFFF', carbon: '#FFFFFF', accent: '#FFFFFF', tire: '#FFFFFF', rim: '#FFFFFF', metal: '#FFFFFF' },
  ink: { frame: '#F5F5F2', frameEnd: '#B9BCC2', carbon: '#141416', accent: '#FF5A1F', tire: '#0B0B0C', rim: '#1A1A1D', metal: '#9EA3AB' },
} satisfies Record<string, BikeTone>;

/** A tapered tube between two points, width w1 → w2, with round ends. */
function tube(a: Pt, b: Pt, w1: number, w2: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a1 = { x: a.x + (nx * w1) / 2, y: a.y + (ny * w1) / 2 };
  const a2 = { x: a.x - (nx * w1) / 2, y: a.y - (ny * w1) / 2 };
  const b1 = { x: b.x + (nx * w2) / 2, y: b.y + (ny * w2) / 2 };
  const b2 = { x: b.x - (nx * w2) / 2, y: b.y - (ny * w2) / 2 };
  return `M ${a1.x} ${a1.y} L ${b1.x} ${b1.y} A ${w2 / 2} ${w2 / 2} 0 0 1 ${b2.x} ${b2.y} L ${a2.x} ${a2.y} A ${w1 / 2} ${w1 / 2} 0 0 1 ${a1.x} ${a1.y} Z`;
}

/** A line running along a tube, offset from its centre by `k` half-widths (−1 top edge … 1 bottom edge). */
function along(a: Pt, b: Pt, w1: number, w2: number, k: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const t = 0.12;
  const s = { x: a.x + dx * t + (nx * w1 * k) / 2, y: a.y + dy * t + (ny * w1 * k) / 2 };
  const e = { x: b.x - dx * t + (nx * w2 * k) / 2, y: b.y - dy * t + (ny * w2 * k) / 2 };
  return `M ${s.x} ${s.y} L ${e.x} ${e.y}`;
}

// Frame nodes
const HEAD_TOP = { x: 207, y: 55 };
const HEAD_BOT = { x: 214, y: 90 };
const SEAT_TOP = { x: 121, y: 56 };
const SEAT_CLUSTER = { x: 125, y: 70 };
const STAY_JOIN = { x: 129, y: 84 };
const TT_END = { x: HEAD_TOP.x + 1, y: HEAD_TOP.y + 6 };
const DT_START = { x: HEAD_BOT.x - 2, y: HEAD_BOT.y - 5 };

function useSpin(periodMs: number | null) {
  const value = useAnimatedValue(0);
  useEffect(() => {
    if (periodMs == null || periodMs <= 0) {
      value.stopAnimation();
      return;
    }
    value.setValue(0);
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: periodMs, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [periodMs, value]);
  return value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

function Wheel({ tone, line, scale, id }: { tone: BikeTone; line: boolean; scale: number; id: string }) {
  const r = WHEEL_R;
  const size = (r + 3) * 2;
  const spokes = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
  if (line) {
    return (
      <Svg width={size * scale} height={size * scale} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
        <Circle r={r - 1} stroke={tone.tire} strokeWidth={2.4} fill="none" />
        <Circle r={r - 13} stroke={tone.rim} strokeWidth={1.2} fill="none" />
        {spokes.map((a) => (
          <Line key={a} x1={Math.cos(a) * 6} y1={Math.sin(a) * 6} x2={Math.cos(a) * (r - 13)} y2={Math.sin(a) * (r - 13)} stroke={tone.rim} strokeWidth={0.8} />
        ))}
        <Circle r={9} stroke={tone.rim} strokeWidth={1} fill="none" />
      </Svg>
    );
  }
  return (
    <Svg width={size * scale} height={size * scale} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
      <Defs>
        <RadialGradient id={`${id}rim`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.66" stopColor="#3A3A40" />
          <Stop offset="0.84" stopColor={tone.rim} />
          <Stop offset="1" stopColor="#050506" />
        </RadialGradient>
      </Defs>
      {/* tire, with a whisper of tan sidewall */}
      <Circle r={r - 2} stroke={tone.tire} strokeWidth={5} fill="none" />
      <Circle r={r - 4.8} stroke="#4A3A2A" strokeWidth={0.9} fill="none" opacity={0.9} />
      {/* 50 mm carbon rim */}
      <Circle r={r - 11} stroke={`url(#${id}rim)`} strokeWidth={13} fill="none" />
      <Circle r={r - 17.6} stroke="rgba(255,255,255,0.10)" strokeWidth={0.8} fill="none" />
      {/* rim graphics: soft light arcs and a small accent stripe */}
      <Path d={`M ${-(r - 11)} -4 A ${r - 11} ${r - 11} 0 0 1 ${-(r - 24)} ${-(r - 30)}`} stroke="rgba(255,255,255,0.35)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d={`M ${r - 11} 10 A ${r - 11} ${r - 11} 0 0 1 ${r - 22} ${r - 32}`} stroke={tone.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* bladed spokes */}
      {spokes.map((a, i) => (
        <Line
          key={a}
          x1={Math.cos(a + (i % 2 ? 0.08 : -0.08)) * 7}
          y1={Math.sin(a + (i % 2 ? 0.08 : -0.08)) * 7}
          x2={Math.cos(a) * (r - 17.5)}
          y2={Math.sin(a) * (r - 17.5)}
          stroke="rgba(190,192,198,0.55)"
          strokeWidth={1}
        />
      ))}
      {/* disc rotor + hub */}
      <Circle r={10.5} stroke={tone.metal} strokeWidth={2.2} fill="none" />
      {Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3).map((a) => (
        <Circle key={a} cx={Math.cos(a) * 7} cy={Math.sin(a) * 7} r={1.5} fill={tone.metal} />
      ))}
      <Circle r={4.2} fill="#2C2C2E" stroke={tone.metal} strokeWidth={1} />
    </Svg>
  );
}

function Crank({ tone, line, scale }: { tone: BikeTone; line: boolean; scale: number }) {
  const s = 60;
  return (
    <Svg width={s * scale} height={s * scale} viewBox={`${-s / 2} ${-s / 2} ${s} ${s}`}>
      <Path d={tube({ x: 0, y: 0 }, { x: 0, y: 23 }, line ? 2 : 5.5, line ? 2 : 4)} fill={line ? 'none' : tone.carbon} stroke={line ? tone.metal : 'none'} strokeWidth={1} />
      <Rect x={-6} y={21} width={12} height={4} rx={1.5} fill={line ? 'none' : tone.carbon} stroke={tone.metal} strokeWidth={0.8} />
      <Circle r={4.5} fill={line ? 'none' : tone.metal} stroke={line ? tone.metal : 'none'} />
    </Svg>
  );
}

export function RoadBike({
  width,
  tone = BIKE_TONES.ember,
  line = false,
  wheelPeriodMs = null,
  style,
}: {
  width: number;
  tone?: BikeTone;
  /** Line-art for washes behind the ride clock. */
  line?: boolean;
  /** One wheel turn in ms; null holds still. Cranks turn at a matching cadence. */
  wheelPeriodMs?: number | null;
  style?: ViewStyle;
}) {
  const scale = width / VB.w;
  const height = VB.h * scale;
  // SVG ids are document-global on web: each bike needs its own gradient ids.
  const id = `bike${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const wheelSpin = useSpin(wheelPeriodMs);
  const crankSpin = useSpin(wheelPeriodMs == null ? null : Math.round(wheelPeriodMs * 2.4));
  const wheelBox = (WHEEL_R + 3) * 2 * scale;
  const crankBox = 60 * scale;

  const paint = line ? 'none' : `url(#${id}paint)`;
  const carbon = line ? 'none' : `url(#${id}carbon)`;
  const outline = line ? { stroke: tone.frame, strokeWidth: 1.4 } : {};

  const chainStay = tube(BB, REAR, 7, 4.5);
  const seatStay = tube(STAY_JOIN, REAR, 4.5, 3.5);
  const seatTube = `M ${SEAT_TOP.x - 4} ${SEAT_TOP.y} Q ${SEAT_TOP.x - 2} 96 ${BB.x - 7} ${BB.y - 4} L ${BB.x + 5} ${BB.y - 2} Q ${SEAT_TOP.x + 10} 94 ${SEAT_TOP.x + 5} ${SEAT_TOP.y} Z`;
  const topTube = tube(SEAT_CLUSTER, TT_END, 6, 8);
  const downTube = tube(DT_START, BB, 12, 15);
  const headTube = `M ${HEAD_TOP.x - 5} ${HEAD_TOP.y} L ${HEAD_TOP.x + 5} ${HEAD_TOP.y - 1} L ${HEAD_BOT.x + 5} ${HEAD_BOT.y} Q ${HEAD_BOT.x} ${HEAD_BOT.y + 5} ${HEAD_BOT.x - 6} ${HEAD_BOT.y - 1} Z`;
  const fork = `M ${HEAD_BOT.x - 4} ${HEAD_BOT.y - 2} Q ${HEAD_BOT.x + 7} 104 ${FRONT.x - 1} ${FRONT.y} L ${FRONT.x + 3} ${FRONT.y - 1} Q ${HEAD_BOT.x + 13} 100 ${HEAD_BOT.x + 5} ${HEAD_BOT.y - 1} Z`;
  const seatPost = tube(SEAT_TOP, { x: 116, y: 41 }, 6, 5);
  const saddle = 'M 97 39 Q 104 34.5 118 35.5 Q 128 36 134 38.5 Q 128 41 118 41 Q 106 41.5 99 42.5 Z';
  const cockpit = `M ${HEAD_TOP.x - 1} ${HEAD_TOP.y - 3} L 225 50.5 Q 233 49 236 52 L 237 56 Q 241 70 234 77 L 229 79`;
  const hood = 'M 229 49 Q 234 43 238 46 L 237 52 Z';
  const bottle = tube({ x: 188, y: 97 }, { x: 162, y: 112 }, 9, 9);
  const cage = tube({ x: 189, y: 101 }, { x: 163, y: 116 }, 1.4, 1.4);
  const ring = 17;

  return (
    <View style={[{ width, height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {line ? null : (
        <Svg width={width} height={height} viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <RadialGradient id={`${id}shadow`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#000" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={(REAR.x + FRONT.x) / 2} cy={REAR.y + WHEEL_R + 1} rx={135} ry={5.5} fill={`url(#${id}shadow)`} />
        </Svg>
      )}
      <Animated.View style={{ position: 'absolute', left: REAR.x * scale - wheelBox / 2, top: REAR.y * scale - wheelBox / 2, transform: [{ rotate: wheelSpin }] }}>
        <Wheel tone={tone} line={line} scale={scale} id={`${id}r`} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: FRONT.x * scale - wheelBox / 2, top: FRONT.y * scale - wheelBox / 2, transform: [{ rotate: wheelSpin }] }}>
        <Wheel tone={tone} line={line} scale={scale} id={`${id}f`} />
      </Animated.View>

      <Svg width={width} height={height} viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id={`${id}paint`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={tone.frame} />
            <Stop offset="1" stopColor={tone.frameEnd} />
          </LinearGradient>
          <LinearGradient id={`${id}carbon`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2A2A2E" />
            <Stop offset="1" stopColor={tone.carbon} />
          </LinearGradient>
        </Defs>

        {/* drivetrain behind the frame */}
        <G opacity={line ? 0.8 : 1}>
          <Path d={`M ${BB.x} ${BB.y - ring} L ${REAR.x} ${REAR.y - 8} M ${BB.x} ${BB.y + ring} L ${REAR.x + 2} ${REAR.y + 8}`} stroke={line ? tone.metal : '#5A5E66'} strokeWidth={line ? 0.9 : 1.6} />
          <Circle cx={REAR.x} cy={REAR.y} r={9} stroke={line ? tone.metal : '#7A7F88'} strokeWidth={line ? 0.9 : 2.2} fill="none" />
          <Path d={`M ${REAR.x + 2} ${REAR.y + 2} L ${REAR.x + 6} ${REAR.y + 14} L ${REAR.x - 2} ${REAR.y + 18} Z`} fill={line ? 'none' : tone.carbon} stroke={line ? tone.metal : '#5A5E66'} strokeWidth={1} />
        </G>

        {/* rear triangle, carbon-dipped for the two-tone look */}
        <Path d={chainStay} fill={carbon} {...outline} />
        <Path d={seatStay} fill={carbon} {...outline} />
        {/* seat tube hugs the rear wheel */}
        <Path d={seatTube} fill={paint} {...outline} />
        <Path d={seatPost} fill={line ? 'none' : tone.carbon} {...outline} />
        <Path d={saddle} fill={line ? 'none' : '#0B0B0C'} stroke={line ? tone.frame : '#2C2C2E'} strokeWidth={line ? 1.4 : 0.8} />
        {/* front triangle */}
        <Path d={topTube} fill={paint} {...outline} />
        <Path d={downTube} fill={paint} {...outline} />
        {/* bottle + cage */}
        <Path d={bottle} fill={line ? 'none' : tone.accent} {...outline} />
        <Path d={cage} fill={line ? 'none' : '#0B0B0C'} {...outline} />
        {/* head tube, fork in carbon */}
        <Path d={headTube} fill={paint} {...outline} />
        <Path d={fork} fill={carbon} {...outline} />
        {/* one-piece cockpit, cables hidden inside */}
        <Path d={cockpit} stroke={line ? tone.frame : tone.carbon} strokeWidth={line ? 1.4 : 5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={hood} fill={line ? 'none' : '#1C1C1E'} stroke={line ? tone.frame : 'none'} strokeWidth={1} />
        {/* chainrings */}
        <Circle cx={BB.x} cy={BB.y} r={ring} fill={line ? 'none' : '#1C1C1E'} stroke={line ? tone.metal : '#8E939B'} strokeWidth={line ? 1 : 1.6} />
        <Circle cx={BB.x} cy={BB.y} r={12.5} fill="none" stroke={line ? tone.metal : '#5A5E66'} strokeWidth={1} />

        {/* gloss: one line of light along each painted tube, and a quiet pinstripe */}
        {line ? null : (
          <G strokeLinecap="round" fill="none">
            <Path d={along(SEAT_CLUSTER, TT_END, 6, 8, -0.45)} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
            <Path d={along(DT_START, BB, 12, 15, -0.55)} stroke="rgba(255,255,255,0.5)" strokeWidth={1.6} />
            <Path d={along(DT_START, BB, 12, 15, 0.35)} stroke={tone.accent} strokeWidth={1.3} opacity={0.9} />
            <Path d={`M ${HEAD_TOP.x - 2} ${HEAD_TOP.y + 4} L ${HEAD_BOT.x - 3} ${HEAD_BOT.y - 6}`} stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} />
            <Path d={`M ${SEAT_TOP.x - 1} ${SEAT_TOP.y + 6} Q ${SEAT_TOP.x} 90 ${BB.x - 6} ${BB.y - 14}`} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          </G>
        )}
      </Svg>

      <Animated.View style={{ position: 'absolute', left: BB.x * scale - crankBox / 2, top: BB.y * scale - crankBox / 2, transform: [{ rotate: crankSpin }] }}>
        <Crank tone={tone} line={line} scale={scale} />
      </Animated.View>
    </View>
  );
}

/** A dashed road line that streams under the bike. Speed follows the wheels. */
export function RoadStream({ width, periodMs, color = 'rgba(255,255,255,0.35)' }: { width: number; periodMs: number | null; color?: string }) {
  const x = useAnimatedValue(0);
  const dash = 28;
  const gap = 22;
  useEffect(() => {
    if (periodMs == null) {
      x.stopAnimation();
      return;
    }
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: periodMs, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [periodMs, x]);
  const shift = x.interpolate({ inputRange: [0, 1], outputRange: [0, -(dash + gap)] });
  const count = Math.ceil(width / (dash + gap)) + 2;
  return (
    <View style={{ width, height: 3, overflow: 'hidden' }} accessibilityElementsHidden>
      <Animated.View style={{ flexDirection: 'row', gap, transform: [{ translateX: shift }] }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: dash, height: 3, borderRadius: 1.5, backgroundColor: color }} />
        ))}
      </Animated.View>
    </View>
  );
}
