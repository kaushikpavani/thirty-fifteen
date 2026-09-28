import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PowerMeterPanel } from '../components/PowerMeterPanel';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export default function PowerRoute() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="power-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Power meter</Text>
      </View>
      <View style={styles.body}>
        <PowerMeterPanel variant="settings" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  back: { color: '#0A84FF', fontSize: 17 },
  title: { color: colors.white, fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
  body: { paddingHorizontal: 20, paddingTop: 18 },
});
