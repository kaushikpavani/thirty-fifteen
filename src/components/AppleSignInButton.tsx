import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Apple's system button. It is the review-safe Continue with Apple control.
 * Rendered only on iOS. Google stays a separate row beside it.
 */
export function AppleSignInButton({
  onPress,
  disabled = false,
  inset = true,
  testID,
}: {
  onPress: () => void;
  disabled?: boolean;
  inset?: boolean;
  testID?: string;
}) {
  if (Platform.OS !== 'ios') return null;
  return (
    <View style={[styles.wrap, inset ? styles.inset : styles.flush]} testID={testID}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={12}
        style={styles.button}
        onPress={() => {
          if (disabled) return;
          onPress();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  inset: { marginHorizontal: 16 },
  flush: { marginTop: 8 },
  button: { width: '100%', height: 44 },
});
