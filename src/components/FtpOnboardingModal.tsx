import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { derivedWatts } from '../workout/defaults';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  visible: boolean;
  initialFtp: number;
  hardPct: number;
  easyPct: number;
  onConfirm: (ftp: number) => void;
  mode?: 'onboard' | 'edit';
};

export function FtpOnboardingModal({
  visible,
  initialFtp,
  hardPct,
  easyPct,
  onConfirm,
  mode = 'onboard',
}: Props) {
  const [text, setText] = useState(String(initialFtp));

  useEffect(() => {
    if (visible) setText(String(initialFtp));
  }, [visible, initialFtp]);

  const ftp = useMemo(() => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : initialFtp;
  }, [text, initialFtp]);

  const targets = derivedWatts(ftp, hardPct, easyPct);
  const valid = ftp >= 50 && ftp <= 600;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{mode === 'edit' ? 'POWER' : 'ONE NUMBER'}</Text>
          <Text style={styles.title}>{mode === 'edit' ? 'Update FTP' : 'Your FTP.'}</Text>
          <Text style={styles.sub}>
            Watts you can hold. Hard is {hardPct}%. Easy is {easyPct}%. Change it whenever you want.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="number-pad"
              selectTextOnFocus
              style={styles.input}
              placeholder="125"
              placeholderTextColor={colors.textDim}
              maxLength={3}
              testID="ftp-input"
            />
            <Text style={styles.unit}>W</Text>
          </View>

          <View style={styles.targets}>
            <View style={styles.targetChip}>
              <Text style={[styles.targetLabel, { color: colors.hard }]}>HARD</Text>
              <Text style={styles.targetVal}>{targets.hard}</Text>
            </View>
            <View style={styles.targetChip}>
              <Text style={[styles.targetLabel, { color: colors.easy }]}>EASY</Text>
              <Text style={styles.targetVal}>{targets.easy}</Text>
            </View>
          </View>

          <PrimaryButton
            label="Save"
            testID="ftp-save"
            onPress={() => valid && onConfirm(ftp)}
            disabled={!valid}
          />
          <Pressable onPress={() => onConfirm(initialFtp)} style={styles.skip} testID="ftp-default">
            <Text style={styles.skipText}>Use {initialFtp} W</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  kicker: {
    color: colors.textDim,
    fontWeight: '600',
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: -0.6,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 64,
    fontWeight: '200',
    color: colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 14,
  },
  targets: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 8,
  },
  targetChip: { flex: 1, gap: 2 },
  targetLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  targetVal: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: colors.textMuted, fontWeight: '500' },
});
