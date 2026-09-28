import React from 'react';
import { Linking, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, NavBack, Row, SectionHeader } from '../components/kit/Grouped';
import { credits } from '../content/credits';

export function CreditsScreen() {
  const items = credits();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <NavBack label="Settings" testID="credits-back" />
        <LargeTitle>Credits</LargeTitle>
        <SectionHeader>Thanks to</SectionHeader>
        <Group>
          {items.map((c) => (
            <Row
              key={c.title}
              label={c.title}
              detail={c.detail}
              onPress={c.url ? () => void Linking.openURL(c.url!) : undefined}
            />
          ))}
        </Group>
        <Footer>30/15 is free. Forever.</Footer>
      </ScrollView>
    </Screen>
  );
}
