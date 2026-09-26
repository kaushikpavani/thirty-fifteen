import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TextStyle } from 'react-native';

const native = Platform.OS !== 'web';

type ClockProps = {
  value: string;
  color: string;
  fontSize: number;
  dim?: boolean;
  /** Changes on a phase boundary. One short scale punch, then still. */
  phase?: string;
  reduceMotion?: boolean;
  testID?: string;
};

/** Only the digit that changed moves. The rest of the countdown stays put. */
export function DigitClock({ value, color, fontSize, dim = false, phase, reduceMotion = false, testID }: ClockProps) {
  const chars = value.split('');
  const scale = useRef(new Animated.Value(1)).current;
  const punched = useRef(phase);

  useEffect(() => {
    if (phase === punched.current) return;
    punched.current = phase;
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    scale.setValue(1.06);
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: native }).start();
  }, [phase, reduceMotion, scale]);

  return (
    <Animated.View style={[styles.row, { transform: [{ scale }] }]} testID={testID}>
      {chars.map((char, index) => (
        <Digit
          key={`${chars.length}-${index}`}
          char={char}
          color={color}
          fontSize={fontSize}
          dim={dim}
          reduceMotion={reduceMotion}
        />
      ))}
    </Animated.View>
  );
}

function Digit({
  char,
  color,
  fontSize,
  dim,
  reduceMotion,
}: {
  char: string;
  color: string;
  fontSize: number;
  dim: boolean;
  reduceMotion: boolean;
}) {
  const [shown, setShown] = useState(char);
  const opacity = useRef(new Animated.Value(dim ? 0.55 : 1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const colon = char === ':';

  useEffect(() => {
    if (!dim) return;
    opacity.setValue(0.55);
  }, [dim, opacity]);

  useEffect(() => {
    if (char === shown) return;
    if (colon || shown === ':' || reduceMotion) {
      setShown(char);
      shift.setValue(0);
      opacity.setValue(dim ? 0.55 : 1);
      return;
    }
    shift.setValue(4);
    opacity.setValue(0.72);
    const settle = Animated.parallel([
      Animated.timing(opacity, { toValue: dim ? 0.55 : 1, duration: 90, useNativeDriver: native }),
      Animated.timing(shift, { toValue: 0, duration: 90, useNativeDriver: native }),
    ]);
    const frame = requestAnimationFrame(() => setShown(char));
    settle.start();
    return () => {
      cancelAnimationFrame(frame);
      settle.stop();
    };
  }, [char, colon, dim, opacity, reduceMotion, shift, shown]);

  return (
    <Animated.Text
      style={{
        color,
        fontSize,
        lineHeight: fontSize + 4,
        fontWeight: '200',
        fontVariant: ['tabular-nums'],
        letterSpacing: colon ? 0 : -1,
        width: colon ? fontSize * 0.28 : fontSize * 0.56,
        textAlign: 'center',
        opacity,
        transform: [{ translateY: shift }],
      }}
    >
      {shown}
    </Animated.Text>
  );
}

type FadeProps = {
  value: string;
  style?: TextStyle;
  testID?: string;
};

export function FadeLabel({ value, style, testID }: FadeProps) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value === shownRef.current) return;
    let cancelled = false;
    const fade = Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: native });
    fade.start(({ finished }) => {
      if (!finished || cancelled) return;
      shownRef.current = value;
      setShown(value);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: native }).start();
    });
    return () => {
      cancelled = true;
      fade.stop();
    };
  }, [opacity, value]);

  return (
    <Animated.Text testID={testID} style={[style, { opacity }]}>
      {shown}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
