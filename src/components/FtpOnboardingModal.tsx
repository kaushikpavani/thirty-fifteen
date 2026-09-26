import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { derivedWatts } from '../workout/defaults';
import { PrimaryButton } from './PrimaryButton';

const ACCESSORY_ID = 'ftp-done-accessory';

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
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(String(initialFtp));
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (visible) setText(String(initialFtp));
  }, [visible, initialFtp]);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    const focusId = setTimeout(() => inputRef.current?.focus(), 280);
    return () => {
      clearTimeout(focusId);
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const ftp = useMemo(() => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : initialFtp;
  }, [text, initialFtp]);

  const targets = derivedWatts(ftp, hardPct, easyPct);
  const valid = ftp >= 50 && ftp <= 600;

  const closeWith = (value: number) => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    onConfirm(value);
  };

  const save = () => {
    if (!valid) {
      Keyboard.dismiss();
      return;
    }
    closeWith(ftp);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => closeWith(valid ? ftp : initialFtp)}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(28, keyboardInset + 12) }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdropHit]}
          onPress={() => closeWith(valid ? ftp : initialFtp)}
          accessibilityLabel="Close FTP editor"
          testID="ftp-backdrop"
        />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{mode === 'edit' ? 'POWER' : 'ONE NUMBER'}</Text>
              <Text style={styles.title}>{mode === 'edit' ? 'Update FTP' : 'Your FTP.'}</Text>
            </View>
            <Pressable
              onPress={save}
              disabled={!valid}
              hitSlop={12}
              testID="ftp-done"
              accessibilityRole="button"
            >
              <Text style={[styles.done, !valid && styles.doneDisabled]}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.sub}>
            Watts you can hold. Hard is {hardPct}%. Easy is {easyPct}%. Change it whenever you want.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              keyboardType="number-pad"
              inputMode="numeric"
              enterKeyHint="done"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={save}
              selectTextOnFocus
              style={styles.input}
              placeholder="125"
              placeholderTextColor={colors.textDim}
              maxLength={3}
              inputAccessoryViewID={Platform.OS === 'ios' ? ACCESSORY_ID : undefined}
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
          {valid ? null : <Text style={styles.invalid}>Enter 50–600 W</Text>}

          <PrimaryButton label="Save" testID="ftp-save" onPress={save} disabled={!valid} />
          <Pressable onPress={() => closeWith(initialFtp)} style={styles.skip} testID="ftp-default">
            <Text style={styles.skipText}>Use {initialFtp} W</Text>
          </Pressable>
        </View>
      </View>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Pressable onPress={save} hitSlop={8} testID="ftp-accessory-done" accessibilityRole="button">
              <Text style={styles.accessoryDone}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropHit: { zIndex: 0 },
  card: {
    zIndex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: { flex: 1, gap: 12 },
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
  done: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 6,
  },
  doneDisabled: { opacity: 0.35 },
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
  invalid: { color: colors.textMuted, fontSize: 14 },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: colors.textMuted, fontWeight: '500' },
  accessory: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  accessoryDone: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
