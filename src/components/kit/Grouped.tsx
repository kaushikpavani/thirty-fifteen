import React from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { ink, radius, type } from '../../theme/tokens';
import { GlassButton } from './Glass';
import { Icon, type IconName } from './Icon';

/** iOS inset-grouped list pieces, tuned to Carbon & Ember. */

/** The back button: a glass circle with a chevron, as in iOS 26. The label is spoken, not shown. */
export function NavBack({ label, testID, title, inset = 16 }: { label: string; testID?: string; title?: string; inset?: number }) {
  return (
    <View style={[styles.nav, { paddingHorizontal: inset }]}>
      <GlassButton
        icon="back"
        iconSize={20}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        accessibilityLabel={`Back to ${label}`}
        testID={testID}
      />
      {title ? (
        <Text style={styles.navTitle} pointerEvents="none" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  );
}

export function LargeTitle({ children, inset = 20 }: { children: string; inset?: number }) {
  return (
    <Text style={[styles.largeTitle, { paddingHorizontal: inset }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function SectionHeader({ children, trailing }: { children: string; trailing?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children.toUpperCase()}</Text>
      {trailing}
    </View>
  );
}

export function Footer({ children }: { children: React.ReactNode }) {
  return <Text style={styles.footer}>{children}</Text>;
}

export function Group({ children, style, inset = 16 }: { children: React.ReactNode; style?: ViewStyle; inset?: number }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={[styles.hairline, { marginLeft: inset }]} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

export function IconTile({ name, bg, fg = '#FFFFFF', size = 30 }: { name: IconName; bg: string; fg?: string; size?: number }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg, width: size, height: size, borderRadius: size * 0.27 }]}>
      <Icon name={name} size={size * 0.54} color={fg} />
    </View>
  );
}

type RowProps = {
  label: string;
  detail?: string;
  value?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  tint?: string;
  testID?: string;
  accessibilityLabel?: string;
  highlighted?: boolean;
  disabled?: boolean;
};

/** Full-bleed row. The whole row is the hit target. */
export function Row({
  label,
  detail,
  value,
  leading,
  trailing,
  onPress,
  chevron = onPress != null,
  tint,
  testID,
  accessibilityLabel,
  highlighted,
  disabled,
}: RowProps) {
  const body = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, tint ? { color: tint } : null]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevron" size={14} color={ink.faint} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, detail ? styles.rowTall : null]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, detail, value].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.row,
        detail ? styles.rowTall : null,
        (pressed || highlighted) && styles.rowPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, testID }: { value: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      trackColor={{ false: '#3A3A3C', true: ink.ember }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#3A3A3C"
      testID={testID}
      {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
    />
  );
}

export function Stepper({
  onMinus,
  onPlus,
  label,
}: {
  onMinus: () => void;
  onPlus: () => void;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} onPress={onMinus} style={styles.stepHit} hitSlop={4}>
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepSplit} />
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} onPress={onPlus} style={styles.stepHit} hitSlop={4}>
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start', marginTop: 4, marginBottom: 6 },
  navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: ink.text, ...type.headline },
  largeTitle: { color: ink.text, ...type.largeTitle, marginTop: 2 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginTop: 28,
    marginBottom: 8,
  },
  section: { color: '#8E8E93', ...type.section },
  footer: { color: '#8E8E93', ...type.caption, paddingHorizontal: 32, marginTop: 8 },
  group: {
    backgroundColor: ink.grouped,
    borderRadius: radius.group,
    overflow: 'hidden',
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 16 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTall: { minHeight: 64, paddingVertical: 10 },
  rowPressed: { backgroundColor: ink.raised },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: ink.text, ...type.body },
  rowDetail: { color: ink.secondary, ...type.caption },
  rowValue: { color: ink.secondary, ...type.body, ...type.tabular, flexShrink: 0, maxWidth: '55%' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: ink.raised, borderRadius: 16, height: 32, overflow: 'hidden' },
  stepHit: { width: 46, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepSplit: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  stepGlyph: { color: ink.text, fontSize: 22, lineHeight: 26 },
});
