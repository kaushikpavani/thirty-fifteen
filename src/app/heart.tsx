import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { HeartRatePanel } from '../components/HeartRatePanel';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export default function HeartRoute() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="heart-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Heart rate</Text>
      </View>
      <View style={styles.body}>
        <HeartRatePanel />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  back: { color: '#0A84FF', fontSize: 17 },
  title: { color: colors.white, fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
  body: { paddingTop: 18 },
});