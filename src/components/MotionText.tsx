import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TextStyle, View } from 'react-native';

const native = Platform.OS !== 'web';

type ClockProps = {
  value: string;
  color: string;
  fontSize: number;
  dim?: boolean;
  testID?: string;
};

/** Only the digit that changed moves. The rest of the countdown stays put. */
export function DigitClock({ value, color, fontSize, dim = false, testID }: ClockProps) {
  const chars = value.split('');
  return (
    <View style={styles.row} testID={testID}>
      {chars.map((char, index) => (
        <Digit
          key={`${chars.length}-${index}`}
          char={char}
          color={color}
          fontSize={fontSize}
          dim={dim}
        />
      ))}
    </View>
  );
}

function Digit({ char, color, fontSize, dim }: { char: string; color: string; fontSize: number; dim: boolean }) {
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
    if (colon || shown === ':') {
      setShown(char);
      return;
    }
    const fade = Animated.timing(opacity, { toValue: 0.45, duration: 70, useNativeDriver: native });
    fade.start(({ finished }) => {
      if (!finished) return;
      setShown(char);
      shift.setValue(6);
      Animated.parallel([
        Animated.timing(opacity, { toValue: dim ? 0.55 : 1, duration: 160, useNativeDriver: native }),
        Animated.timing(shift, { toValue: 0, duration: 160, useNativeDriver: native }),
      ]).start();
    });
    return () => fade.stop();
  }, [char, colon, dim, opacity, shift, shown]);

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
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value === shown) return;
    const fade = Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: native });
    fade.start(({ finished }) => {
      if (!finished) return;
      setShown(value);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: native }).start();
    });
    return () => fade.stop();
  }, [opacity, shown, value]);

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
