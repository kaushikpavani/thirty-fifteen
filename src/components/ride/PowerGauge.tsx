import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { type as t } from '../../theme/tokens';
import { Icon } from '../kit/Icon';
import { gaugeRead } from './gaugeRead';

export { gaugeRead };

const native = Platform.OS !== 'web';
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 240° sweep over the top, open at the bottom like a speedometer. */
const START = 150;
const SWEEP = 240;
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/**
 * Analog power meter around the digital watts. The target is a notch with its
 * number; the fill is live power. Short of target, the gap to the notch pulses.
 * At or over target (within 3%), the arc turns green and a check appears.
 * Never invents a value: no meter, no fill, a quiet dash.
 */
export function PowerGauge({
  watts,
  target,
  width,
  reduceMotion,
}: {
  watts: number | null;
  /** Numeric target for this moment, or null in warm-up / rest. */
  target: number | null;
  width: number;
  reduceMotion: boolean;
}) {
  const w = width;
  const r = w * 0.44;
  const stroke = 12;
  const cx = w / 2;
  const cy = r + stroke + 12;
  const h = cy + r * Math.sin((30 * Math.PI) / 180) + stroke + 6;
  const len = (Math.PI * r * SWEEP) / 180;
  const read = gaugeRead(watts, target);

  // Smooth the needle between BLE samples (about 1 Hz) so it glides, never jumps.
  const fill = useAnimatedValue(read.frac);
  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(read.frac);
      return;
    }
    Animated.timing(fill, { toValue: read.frac, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, read.frac, reduceMotion]);

  // The shortfall breathes; the on-target check lands with a pop.
  const pulse = useAnimatedValue(0.35);
  useEffect(() => {
    if (read.state !== 'under' || reduceMotion) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0.3, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, read.state, reduceMotion]);

  const pop = useAnimatedValue(read.state === 'on' ? 1 : 0);
  const wasOn = useRef(read.state === 'on');
  useEffect(() => {
    const on = read.state === 'on';
    if (on === wasOn.current) return;
    wasOn.current = on;
    if (reduceMotion) {
      pop.setValue(on ? 1 : 0);
      return;
    }
    Animated.spring(pop, { toValue: on ? 1 : 0, useNativeDriver: native, speed: 14, bounciness: on ? 12 : 0 }).start();
  }, [read.state, pop, reduceMotion]);

  const on = read.state === 'on';
  const fillColor = on ? '#34E05A' : '#FFFFFF';
  const dashOffset = fill.interpolate({ inputRange: [0, 1], outputRange: [len, 0] });
  const targetDeg = read.targetFrac != null ? START + SWEEP * read.targetFrac : null;
  const currentDeg = START + SWEEP * read.frac;
  const notchIn = targetDeg != null ? polar(cx, cy, r - stroke / 2 - 7, targetDeg) : null;
  const notchOut = targetDeg != null ? polar(cx, cy, r + stroke / 2 + 7, targetDeg) : null;
  const label = targetDeg != null ? polar(cx, cy, r + stroke / 2 + 24, targetDeg) : null;
  const a11y =
    watts == null
      ? 'No power reading'
      : target
        ? `${watts} watts, target ${target}${on ? ', on target' : `, ${Math.max(0, target - watts)} below`}`
        : `${watts} watts`;

  return (
    <View style={{ width: w, height: h }} accessible accessibilityLabel={a11y} testID="power-gauge">
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Path d={arc(cx, cy, r, START, START + SWEEP)} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {read.state === 'under' && targetDeg != null ? (
          <AnimatedPath
            d={arc(cx, cy, r, currentDeg, targetDeg)}
            stroke="#FFFFFF"
            strokeWidth={stroke}
            strokeDasharray="3 5"
            fill="none"
            opacity={pulse}
          />
        ) : null}
        {watts != null ? (
          <AnimatedPath
            d={arc(cx, cy, r, START, START + SWEEP)}
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={dashOffset}
            fill="none"
          />
        ) : null}
        {notchIn && notchOut && label ? (
          <G>
            <Path d={`M ${notchIn.x} ${notchIn.y} L ${notchOut.x} ${notchOut.y}`} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" />
            <Circle cx={notchOut.x} cy={notchOut.y} r={3} fill="#FFFFFF" />
            <SvgText
              x={label.x}
              y={label.y + 5}
              fill="#FFFFFF"
              fontSize={15}
              fontWeight="700"
              textAnchor="middle"
              fontFamily={Platform.OS === 'ios' ? 'System' : 'Helvetica, Arial, sans-serif'}
            >
              {String(target)}
            </SvgText>
          </G>
        ) : null}
      </Svg>

      <View style={[styles.center, { top: cy - 88 }]} pointerEvents="none">
        {watts == null ? (
          <View style={styles.empty} testID="live-watts" />
        ) : (
          <Text style={[t.watts, styles.watts]} testID="live-watts" adjustsFontSizeToFit numberOfLines={1}>
            {String(watts)}
          </Text>
        )}
        <View style={styles.unitRow}>
          <Text style={styles.unit}>W</Text>
          <Animated.View style={[styles.check, styles.checkPos, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
            <Icon name="check" size={13} color="#0B3D17" />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  watts: { color: '#FFFFFF', fontSize: 132, lineHeight: 136 },
  empty: { width: 72, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.45)', marginVertical: 62 },
  unitRow: { alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  checkPos: { position: 'absolute', left: 26, top: 2 },
  unit: { color: 'rgba(255,255,255,0.9)', fontSize: 22, fontWeight: '700' },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#34E05A', alignItems: 'center', justifyContent: 'center' },
});
