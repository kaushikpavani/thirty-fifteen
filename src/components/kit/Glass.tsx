import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { ink } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { tapHaptic, usePressScale } from './press';

/**
 * Glass is for controls that float above content: buttons, bars, the back
 * button. Never for content cards, and never glass on glass. Only the one
 * primary action on a screen is tinted. (Apple, "Meet Liquid Glass" and
 * "Get to know the new design system", WWDC25.)
 *
 * On iOS 26 this is the system's real Liquid Glass. Everywhere else (older
 * iOS, Android, web) it is a blurred, bevelled stand-in with the same shape.
 */
const LIQUID = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

/** OS Reduce Transparency: the stand-in goes solid. Real Liquid Glass adapts by itself. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (live) setReduce(Boolean(value));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (value) => setReduce(Boolean(value)));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export type GlassTint = 'ember' | 'danger';

type GlassProps = {
  radius: number;
  /** Only for the primary action on a screen. */
  tint?: GlassTint;
  /** Lights up under the finger on iOS 26. On for anything pressable. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const TINT: Record<GlassTint, { color: string; ramp: readonly [string, string, string] }> = {
  ember: { color: ink.ember, ramp: ['#FF8450', '#FF5A1F', '#EE470E'] },
  danger: { color: '#C4372B', ramp: ['#E0564A', '#C4372B', '#A92C22'] },
};

export function Glass({ radius, tint, interactive = false, style, children }: GlassProps) {
  const solid = useReduceTransparency();
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        tintColor={tint ? TINT[tint].color : undefined}
        style={[{ borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.clip, { borderRadius: radius }, tint ? null : solid ? styles.solid : styles.frost, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backing]}>
        {tint ? (
          <LinearGradient pointerEvents="none" colors={TINT[tint].ramp} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        ) : (
          <>
            {solid ? null : <BlurView pointerEvents="none" intensity={36} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />}
            {/* Light from above: bright at the top lip, falling away by the middle. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.10)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }, tint ? styles.rimTint : null]} />
      </View>
      {children}
    </View>
  );
}

type GlassButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  size?: number;
  iconSize?: number;
  color?: string;
  testID?: string;
  haptic?: 'light' | 'medium';
  style?: StyleProp<ViewStyle>;
};

/** A round glass control: back, settings, pause. 44 pt is the smallest it goes. */
export function GlassButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 44,
  iconSize = 20,
  color = ink.text,
  testID,
  haptic = 'light',
  style,
}: GlassButtonProps) {
  const { scale, pressIn, pressOut } = usePressScale();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        hitSlop={Math.max(0, (48 - size) / 2) + 4}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapHaptic(haptic);
          onPress();
        }}
      >
        <Glass radius={size / 2} interactive style={[styles.center, { width: size, height: size }]}>
          <Icon name={icon} size={iconSize} color={color} />
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // On the web, absolutely positioned layers paint over unpositioned children (SVG icons), so the backing sits behind.
  backing: Platform.OS === 'web' ? { zIndex: -1 } : {},
  frost: { backgroundColor: 'rgba(118,118,128,0.20)' },
  solid: { backgroundColor: ink.raised },
  rim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  rimTint: { borderColor: 'rgba(255,255,255,0.26)' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
