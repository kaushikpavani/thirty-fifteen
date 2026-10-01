import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, LargeTitle, NavBack, SectionHeader } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { ink, radius, type } from '../theme/tokens';

type Item = { title: string; body: string };

const GAINS: Item[] = [
  {
    title: 'Heart-rate monitor',
    body: 'Heart rate on every ride, your real max heart rate for a sharper VO₂max estimate, and a read on how hard each ride really was so your FTP adjusts correctly.',
  },
  {
    title: 'Power meter',
    body: 'Live watts against your HARD and EASY targets, hard-rep power trends, personal records, and an FTP that learns from your rides.',
  },
  {
    title: 'Both together',
    body: 'Efficiency factor (watts per heartbeat) and HR:Power drift, the clearest signs your aerobic fitness is improving, plus the most accurate VO₂max and FTP.',
  },
];

const HEART: Item[] = [
  {
    title: 'Chest straps (best for 30/15)',
    body: 'Any Bluetooth strap works: Polar H10 or H9, Garmin HRM-Pro or HRM-Dual, Wahoo TICKR, COROS and others. Armbands such as Polar Verity Sense work too.',
  },
  {
    title: 'Garmin watches',
    body: 'Newer models (Forerunner 255 and later, fēnix, epix, Venu 2 and later) broadcast over Bluetooth: Settings › Sensors & Accessories › Heart Rate › Broadcast Heart Rate. Older models broadcast ANT+ only, which iPhone can’t receive.',
  },
  {
    title: 'Apple Watch',
    body: 'Apple Watch doesn’t broadcast heart rate on its own. Install a broadcaster app on the watch, such as HeartCast or BlueHeart, start it, then connect in 30/15.',
  },
  {
    title: 'Pixel Watch 2, 3 and 4',
    body: 'On Wear OS 6, swipe down from the top of the watch and tap the connected-fitness icon to start broadcasting.',
  },
  {
    title: 'Other watches and bands',
    body: 'If it has a “broadcast heart rate” option that uses Bluetooth, it works with 30/15.',
  },
];

const POWER: Item[] = [
  {
    title: 'Pedals',
    body: 'Garmin Rally, Favero Assioma, Wahoo POWRLINK Zero and other Bluetooth pedals.',
  },
  {
    title: 'Crank and spider meters',
    body: 'Stages, 4iiii, Quarq and SRAM, and Shimano’s Bluetooth models.',
  },
  {
    title: 'Smart trainers and smart bikes',
    body: 'Wahoo KICKR, Tacx and Garmin trainers, Elite, Zwift Hub, Saris and others. If it shows up in Zwift over Bluetooth, it shows up here.',
  },
  {
    title: 'Not supported',
    body: 'Meters that only speak ANT+ (iPhone has no ANT+ radio), and bikes that don’t broadcast power over standard Bluetooth.',
  },
];

const TIPS: Item[] = [
  {
    title: 'Can’t find it?',
    body: 'Most sensors allow only one or two Bluetooth connections. Close Zwift, the maker’s app, or your bike computer’s link to it, then search again.',
  },
  {
    title: 'Wake it up',
    body: 'Spin the cranks or pedals to wake a power meter. Wet a chest strap’s contacts and put it on before you search.',
  },
  {
    title: 'Wrist vs chest',
    body: 'Watches read heart rate at the wrist and lag behind fast changes. For 30-second efforts, a chest strap follows each HARD and EASY swing far better.',
  },
];

function List({ items, testID }: { items: Item[]; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      {items.map((item, i) => (
        <View key={item.title} style={[styles.item, i > 0 && styles.divider]}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemBody}>{item.body}</Text>
        </View>
      ))}
    </View>
  );
}

/** What 30/15 can connect to, and why it's worth it. Linked from Home and Settings. */
export function SensorGuideScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Back" testID="sensor-guide-back" />
        <LargeTitle>What can I connect?</LargeTitle>
        <Text style={styles.intro}>
          30/15 connects over Bluetooth to any heart-rate monitor or power meter that uses the standard Bluetooth fitness
          profiles. No account or extra app needed for most devices. Sensors are optional: every ride still works without
          them.
        </Text>

        <SectionHeader>What each one adds</SectionHeader>
        <List items={GAINS} testID="guide-gains" />

        <SectionHeader>Heart-rate monitors</SectionHeader>
        <List items={HEART} testID="guide-heart" />

        <SectionHeader>Power meters</SectionHeader>
        <List items={POWER} testID="guide-power" />

        <SectionHeader>If it doesn’t connect</SectionHeader>
        <List items={TIPS} />

        <View style={styles.actions}>
          <Pill label="Connect heart rate" variant="light" icon="heart" onPress={() => router.push('/heart')} testID="guide-connect-heart" />
          <Pill label="Connect power meter" variant="quiet" icon="bolt" onPress={() => router.push('/power')} testID="guide-connect-power" />
        </View>
        <Footer>Device names are examples, not endorsements. Anything using the standard Bluetooth heart-rate or cycling-power profile should work.</Footer>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  intro: { color: ink.secondary, ...type.callout, marginTop: 8 },
  card: { backgroundColor: ink.surface, borderRadius: radius.group, paddingHorizontal: 16 },
  item: { paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.hairline },
  itemTitle: { color: ink.text, ...type.headline, fontSize: 16 },
  itemBody: { color: ink.secondary, ...type.callout, marginTop: 4 },
  actions: { gap: 10, marginTop: 24 },
});
