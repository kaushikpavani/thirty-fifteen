import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  bottom?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, bottom = false, style }: Props) {
  return (
    <View style={styles.root}>
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
  safe: { flex: 1 },
});
