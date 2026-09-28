import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { LinearGradient } from 'expo-linear-gradient';
import { fields, motion, type Field } from '../../theme/tokens';

const native = Platform.OS !== 'web';
const FEATHER = 90;

function FieldLayer({ field, height }: { field: Field; height: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: field.base }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0)', field.glow]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.glow, { height: Math.round(height * 0.62) }]}
      />
    </View>
  );
}

/**
 * The ride's full-bleed color. Color is the clock:
 * - the field cross-fades on a phase change,
 * - a soft shade falls from the top as the segment runs out,
 * - in the last three seconds before HARD, ember rises from the bottom edge.
 * Reduce Motion: cuts instead of fades; the shade and rise still track time.
 */
export function PhaseField({
  field,
  progress,
  rise,
  reduceMotion,
}: {
  field: Field;
  /** 0 at segment start, 1 at its end. */
  progress: number;
  /** 0..1 through the count-in to HARD, or null. */
  rise: number | null;
  reduceMotion: boolean;
}) {
  const { height } = useWindowDimensions();
  const [over, setOver] = useState(field);
  const [under, setUnder] = useState<Field | null>(null);
  const fade = useAnimatedValue(1);
  const shade = useAnimatedValue(progress);
  const riseValue = useAnimatedValue(rise ?? 0);

  // A new phase: keep the old field underneath and fade the new one in over it.
  // Derived during render (not in an effect) so the first frame is already layered.
  if (field !== over) {
    setUnder(reduceMotion ? null : over);
    setOver(field);
  }

  useLayoutEffect(() => {
    if (!under) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const run = Animated.timing(fade, {
      toValue: 1,
      duration: motion.phaseMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    });
    run.start(({ finished }) => {
      if (finished) setUnder(null);
    });
    return () => run.stop();
  }, [over, under, fade]);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    // A new segment snaps the shade back up; within a segment it glides with the tick.
    const snapping = target < 0.02;
    if (snapping) {
      shade.setValue(target);
      return;
    }
    Animated.timing(shade, { toValue: target, duration: 110, easing: Easing.linear, useNativeDriver: native }).start();
  }, [progress, shade]);

  useEffect(() => {
    const target = rise == null ? 0 : Math.max(0, Math.min(1, rise));
    if (rise == null || reduceMotion) {
      riseValue.setValue(target);
      return;
    }
    Animated.timing(riseValue, { toValue: target, duration: 110, easing: Easing.linear, useNativeDriver: native }).start();
  }, [rise, reduceMotion, riseValue]);

  const block = height + FEATHER;
  const shadeY = shade.interpolate({ inputRange: [0, 1], outputRange: [-block, 0] });
  const riseH = Math.round(height * 0.62);
  const riseY = riseValue.interpolate({ inputRange: [0, 1], outputRange: [riseH, riseH * 0.12] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {under ? <FieldLayer field={under} height={height} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <FieldLayer field={over} height={height} />
      </Animated.View>
      <Animated.View style={[styles.shade, { height: block, transform: [{ translateY: shadeY }] }]}>
        <LinearGradient
          colors={[over.shade, over.shade, 'rgba(0,0,0,0)']}
          locations={[0, height / block, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {rise != null ? (
        <Animated.View style={[styles.rise, { height: riseH, transform: [{ translateY: riseY }] }]}>
          <LinearGradient
            colors={['rgba(224,65,15,0)', 'rgba(224,65,15,0.85)', fields.hard.base]}
            locations={[0, 0.3, 0.6]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', fields.hard.glow]}
            style={[StyleSheet.absoluteFill, { top: riseH * 0.4 }]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  shade: { position: 'absolute', left: 0, right: 0, top: 0 },
  rise: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
