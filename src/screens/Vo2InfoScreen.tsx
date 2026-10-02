import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Footer, LargeTitle, NavBack, SectionHeader } from '../components/kit/Grouped';
import { VO2_NORMS_SOURCE } from '../data/vo2Norms';
import { ink, radius, type } from '../theme/tokens';

type Item = { title: string; body: string };
type Source = { title: string; cite: string; use: string; url: string };

const COMPARISON: Item[] = [
  {
    title: 'Who you’re compared with',
    body: `${VO2_NORMS_SOURCE.tests.toLocaleString()} treadmill tests of healthy adults aged 20 to 89, measured with a breathing mask in 34 US exercise labs. This is the FRIEND registry, the largest set of directly measured fitness results published.`,
  },
  {
    title: 'Five-year age groups',
    body: 'The study publishes its results in ten-year groups. Fitness falls steadily with age, so we estimate five-year groups by blending each decade with its neighbour: three parts your own decade, one part the decade you’re closer to. The youngest (20–24) and oldest (85+) groups use the published decade as is.',
  },
  {
    title: 'The shape of the chart',
    body: 'The study gives the 10th through 90th percentiles. Between those, bars come straight from the published numbers. The far ends, below the 10th and above the 90th, are filled in with a standard bell curve, so treat readings there as approximate.',
  },
  {
    title: 'The words we use',
    body: 'Low is the bottom fifth of your group. Then Below average, Average and Above average, a fifth each. Excellent is the top fifth, and Superior the top 5%.',
  },
];

const ESTIMATE: Item[] = [
  {
    title: 'From power',
    body: 'When you have an FTP and a weight, we work out the oxygen it takes to hold that power, using the standard cycling equation from the American College of Sports Medicine.',
  },
  {
    title: 'From heart rate',
    body: 'When you have a resting heart rate, we use the ratio of your maximum to your resting heart rate. Your maximum comes from your rides when we’ve seen one, otherwise from your age.',
  },
  {
    title: 'Both',
    body: 'With both, we average them. The orange bar on the chart is the likely range around your number.',
  },
];

const LIMITS: Item[] = [
  {
    title: 'An estimate, not a lab test',
    body: 'A real VO₂max test measures the air you breathe at an all-out effort. Ours is a field estimate that can be several points off. It’s most useful for watching your own trend over weeks.',
  },
  {
    title: 'Bike vs treadmill',
    body: 'The comparison group was tested running. Most people score a little lower on a bike, so this is a slightly tough comparison for riders.',
  },
  {
    title: 'Who was tested',
    body: 'People in the registry were tested in US labs and had no known heart or lung disease. They are not a random sample of the whole population.',
  },
];

const SOURCES: Source[] = [
  {
    title: 'Comparison data',
    cite: VO2_NORMS_SOURCE.citation,
    use: 'Percentiles by age and sex.',
    url: VO2_NORMS_SOURCE.url,
  },
  {
    title: 'Heart-rate estimate',
    cite: 'Uth N, Sørensen H, Overgaard K, Pedersen PK. Estimation of VO₂max from the ratio between HRmax and HRrest: the Heart Rate Ratio Method. Eur J Appl Physiol. 2004;91(1):111-115.',
    use: 'VO₂max ≈ 15.3 × max heart rate ÷ resting heart rate.',
    url: 'https://doi.org/10.1007/s00421-003-0988-y',
  },
  {
    title: 'Maximum heart rate from age',
    cite: 'Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol. 2001;37(1):153-156.',
    use: 'Max heart rate ≈ 208 − 0.7 × age, used until a ride shows a higher one.',
    url: 'https://doi.org/10.1016/S0735-1097(00)01054-8',
  },
  {
    title: 'Power estimate',
    cite: 'American College of Sports Medicine. ACSM’s Guidelines for Exercise Testing and Prescription. Leg-cycling metabolic equation.',
    use: 'VO₂ = 10.8 × watts ÷ kg + 7, at the power you could hold at your aerobic maximum (taken as FTP ÷ 0.75).',
    url: 'https://www.acsm.org/education-resources/books/guidelines-exercise-testing-prescription',
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

/** Where the VO2max comparison comes from and how the numbers are made. Opened from the chart's info button. */
export function Vo2InfoScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Fitness" testID="vo2-info-back" />
        <LargeTitle>About this chart</LargeTitle>
        <Text style={styles.intro}>
          The chart shows how VO₂max is spread among people of your sex and age, and where your estimate falls. Here is
          where the numbers come from.
        </Text>

        <SectionHeader>The comparison</SectionHeader>
        <List items={COMPARISON} testID="vo2-info-comparison" />

        <SectionHeader>Your number</SectionHeader>
        <List items={ESTIMATE} />

        <SectionHeader>Keep in mind</SectionHeader>
        <List items={LIMITS} />

        <SectionHeader>Sources</SectionHeader>
        <View style={styles.card} testID="vo2-info-sources">
          {SOURCES.map((s, i) => (
            <Pressable
              key={s.title}
              onPress={() => void Linking.openURL(s.url)}
              style={({ pressed }) => [styles.item, i > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`${s.title}. ${s.cite} Opens in your browser.`}
            >
              <Text style={styles.itemTitle}>{s.title}</Text>
              <Text style={styles.itemBody}>{s.use}</Text>
              <Text style={styles.cite}>{s.cite}</Text>
              <Text style={styles.link}>Open source</Text>
            </Pressable>
          ))}
        </View>
        <Footer>The comparison data ships inside the app. Nothing about you is sent anywhere to draw this chart.</Footer>
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
  pressed: { opacity: 0.6 },
  itemTitle: { color: ink.text, ...type.headline, fontSize: 16 },
  itemBody: { color: ink.secondary, ...type.callout, marginTop: 4 },
  cite: { color: ink.tertiary, fontSize: 12, lineHeight: 17, marginTop: 8 },
  link: { color: ink.emberText, fontSize: 13, fontWeight: '600', marginTop: 8 },
});
