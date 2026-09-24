import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
          <Text style={styles.kicker}>{mode === 'edit' ? 'POWER' : 'BEFORE YOU START'}</Text>
          <Text style={styles.title}>{mode === 'edit' ? 'Update your FTP' : "What's your FTP?"}</Text>
          <Text style={styles.sub}>
            Functional Threshold Power in watts. HARD and EASY targets update
            instantly from your FTP. You can also edit this anytime in Settings.
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
            />
            <Text style={styles.unit}>W</Text>
          </View>

          <View style={styles.targets}>
            <View style={[styles.targetChip, { borderColor: colors.hard }]}>
              <Text style={[styles.targetLabel, { color: colors.hard }]}>HARD</Text>
              <Text style={styles.targetVal}>{targets.hard} W</Text>
              <Text style={styles.targetHint}>{hardPct}% · above FTP</Text>
            </View>
            <View style={[styles.targetChip, { borderColor: colors.easy }]}>
              <Text style={[styles.targetLabel, { color: colors.easy }]}>EASY</Text>
              <Text style={styles.targetVal}>{targets.easy} W</Text>
              <Text style={styles.targetHint}>{easyPct}% · light pressure</Text>
            </View>
          </View>

          <PrimaryButton
            label="Save & Continue"
            onPress={() => valid && onConfirm(ftp)}
            disabled={!valid}
            variant="orange"
          />
          <Pressable onPress={() => onConfirm(initialFtp)} style={styles.skip}>
            <Text style={styles.skipText}>Use default {initialFtp} W</Text>
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
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  kicker: {
    color: colors.orange,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontSize: 56,
    fontWeight: '800',
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.teal,
    paddingVertical: 4,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  targets: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  targetChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.bgCard,
    gap: 2,
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  targetVal: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  targetHint: {
    color: colors.textDim,
    fontSize: 11,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});
