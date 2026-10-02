import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';
import { ink } from '../theme/tokens';

type Props = {
  children: React.ReactNode;
  bottom?: boolean;
  style?: ViewStyle;
};

const AMBIENT_H = 460;

/**
 * A faint wash of the two brand colours behind the top of every page: ember
 * from the left, glacier from the right, gone by mid-screen. It gives the
 * glass controls up there something to pick up, and keeps the page from
 * being a flat black. Content stays on true black below it.
 */
function Ambient() {
  return (
    <View pointerEvents="none" style={styles.ambient}>
      <Svg width="100%" height={AMBIENT_H} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="ambEmber" cx="8" cy="0" rx="80" ry="78" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={ink.ember} stopOpacity={0.3} />
            <Stop offset="0.55" stopColor={ink.ember} stopOpacity={0.08} />
            <Stop offset="1" stopColor={ink.ember} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ambGlacier" cx="100" cy="6" rx="70" ry="70" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={ink.glacier} stopOpacity={0.16} />
            <Stop offset="0.6" stopColor={ink.glacier} stopOpacity={0.04} />
            <Stop offset="1" stopColor={ink.glacier} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#ambEmber)" />
        <Rect x={0} y={0} width={100} height={100} fill="url(#ambGlacier)" />
      </Svg>
    </View>
  );
}

export function Screen({ children, bottom = false, style }: Props) {
  return (
    <View style={styles.root}>
      <Ambient />
      <SafeAreaView
        style={[styles.safe, style]}
        edges={bottom ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
      >
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: AMBIENT_H },
  safe: { flex: 1 },
});
