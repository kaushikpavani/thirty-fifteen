import React, { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { Icon, type IconName } from '../kit/Icon';
import { Glass } from '../kit/Glass';
import { tapHaptic, usePressScale } from '../kit/press';
import { ink, motion } from '../../theme/tokens';

/** The only control while the clock runs. Glass, 84 pt, centered under the thumb. */
export function PauseGlass({ onPress }: { onPress: () => void }) {
  const { scale, pressIn, pressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pause"
        testID="pause"
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapHaptic('medium');
          onPress();
        }}
        hitSlop={12}
      >
        <Glass radius={42} interactive style={styles.glass}>
          <Icon name="pause" size={26} color="#FFFFFF" />
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

/** Warm-up only: a smaller glass button beside Pause, labelled underneath. */
export function WarmupJump({ icon, label, hint, onPress, testID }: { icon: IconName; label: string; hint: string; onPress: () => void; testID: string }) {
  const { scale, pressIn, pressOut } = usePressScale();
  return (
    <View style={styles.jumpWrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} warm-up`}
          accessibilityHint={hint}
          testID={testID}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={() => {
            tapHaptic('light');
            onPress();
          }}
          hitSlop={8}
        >
          <Glass radius={28} interactive style={styles.jump}>
            <Icon name={icon} size={20} color="#FFFFFF" />
          </Glass>
        </Pressable>
      </Animated.View>
      <Text style={styles.jumpLabel}>{label}</Text>
    </View>
  );
}

/**
 * Press and hold to end. A sweaty tap cannot end a ride by accident.
 * VoiceOver users get a plain activate action.
 */
export function HoldToEnd({ onEnd }: { onEnd: () => void }) {
  const fill = useAnimatedValue(0);
  const done = useRef(false);
  const run = useRef<Animated.CompositeAnimation | null>(null);

  const begin = () => {
    done.current = false;
    tapHaptic('light');
    run.current?.stop();
    run.current = Animated.timing(fill, {
      toValue: 1,
      duration: motion.holdToEndMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    run.current.start(({ finished }) => {
      if (!finished || done.current) return;
      done.current = true;
      tapHaptic('heavy');
      onEnd();
    });
  };

  const cancel = () => {
    if (done.current) return;
    run.current?.stop();
    Animated.timing(fill, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  };

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End ride"
      accessibilityHint="Press and hold to end the ride. Your ride so far is saved."
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onEnd()}
      testID="end"
      onPressIn={begin}
      onPressOut={cancel}
      style={styles.holdWrap}
    >
      <Glass radius={30} style={styles.hold}>
        <Animated.View style={[styles.holdFill, { width }]} />
        <Text style={styles.holdLabel}>Hold to end</Text>
      </Glass>
    </Pressable>
  );
}

export function StatTriplet({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View style={styles.triplet}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.cell, index > 0 && styles.cellRule]}>
          <Text style={styles.cellValue}>{item.value}</Text>
          <Text style={styles.cellLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  jumpWrap: { alignItems: 'center', gap: 6, marginTop: 22 },
  jump: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  jumpLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  holdWrap: { alignSelf: 'stretch' },
  hold: { height: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,90,70,0.32)' },
  holdLabel: { color: ink.danger, fontSize: 19, fontWeight: '600' },
  triplet: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    overflow: 'hidden',
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  cellRule: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
  cellValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cellLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
