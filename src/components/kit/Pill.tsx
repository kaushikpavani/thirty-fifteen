import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ink } from '../../theme/tokens';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { tapHaptic, usePressScale } from './press';

export { tapHaptic, usePressScale } from './press';

/**
 * ember: the one primary action on a screen, tinted glass.
 * light: a solid white capsule for confirming inside sheets and onboarding.
 * glass / quiet: every other action, plain glass.
 */
type Variant = 'ember' | 'light' | 'glass' | 'quiet';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  height?: number;
  style?: ViewStyle;
  testID?: string;
  disabled?: boolean;
  accessibilityHint?: string;
};

/** The one big capsule button. */
export function Pill({ label, onPress, variant = 'ember', icon, height, style, testID, disabled, accessibilityHint }: Props) {
  const { scale, pressIn, pressOut } = usePressScale();
  const primary = variant === 'ember';
  const h = height ?? (primary || variant === 'light' ? 60 : 52);
  const fg = primary || variant === 'light' ? '#000000' : ink.text;
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.label, !primary && variant !== 'light' && styles.labelQuiet, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return (
    <Animated.View style={[{ transform: [{ scale }], borderRadius: h / 2 }, primary && styles.emberShadow, disabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        testID={testID}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapHaptic(primary ? 'medium' : 'light');
          onPress();
        }}
      >
        {variant === 'light' ? (
          <View style={[styles.base, styles.light, { height: h, borderRadius: h / 2 }]}>{body}</View>
        ) : (
          <Glass radius={h / 2} tint={primary ? 'ember' : undefined} interactive style={[styles.base, { height: h }]}>
            {body}
          </Glass>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  light: { backgroundColor: ink.text },
  disabled: { opacity: 0.4 },
  label: { fontSize: 19, fontWeight: '600', letterSpacing: -0.2 },
  labelQuiet: { fontSize: 17 },
  emberShadow: {
    shadowColor: ink.ember,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
});
