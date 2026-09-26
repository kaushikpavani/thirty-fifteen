import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createSessionFromUrl } from '../auth/oauth';
import { colors } from '../theme/colors';

export default function AuthCallbackRoute() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (typeof params.error_description === 'string') {
          throw new Error(params.error_description);
        }
        if (typeof params.code === 'string') {
          const query = `thirtyfifteen://auth-callback?code=${encodeURIComponent(params.code)}`;
          await createSessionFromUrl(query);
        }
      } catch {
        // The welcome screen surfaces the next attempt.
      }
      if (!cancelled) router.replace('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.error_description]);

  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
