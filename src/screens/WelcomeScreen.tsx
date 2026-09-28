import React, { useEffect } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill } from '../components/kit/Pill';
import { BIKE_TONES, RoadBike, RoadStream } from '../components/bike/RoadBike';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { ink } from '../theme/tokens';
import { WELCOME_PHOTO } from '../content/photos';

const native = Platform.OS !== 'web';
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const fade = useAnimatedValue(reduce ? 1 : 0);
  const roll = useAnimatedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    Animated.timing(fade, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    Animated.timing(roll, { toValue: 1, duration: 1600, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [fade, reduce, roll]);
  const bikeW = Math.min(300, width * 0.74);
  const rollX = roll.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });

  return (
    <View style={styles.root}>
      {WELCOME_PHOTO ? (
        <Animated.View style={[styles.photo, { opacity: fade }]} pointerEvents="none">
          <Image source={WELCOME_PHOTO.source} style={styles.photoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)', '#000']} locations={[0, 0.35, 0.8, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(92,200,230,0.16)', 'rgba(92,200,230,0)']}
        style={styles.sky}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,90,31,0)', 'rgba(255,90,31,0.14)', 'rgba(255,90,31,0.42)']}
        locations={[0, 0.55, 1]}
        style={styles.dusk}
      />
      <View style={[styles.body, { paddingTop: insets.top, paddingBottom: insets.bottom + 18 }]}>
        <View style={{ flex: WELCOME_PHOTO ? 2.4 : 1 }} />
        <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
          <Text style={[styles.word, { marginTop: 0 }]} accessibilityRole="header" accessibilityLabel="30 15">
            30<Text style={{ color: ink.ember }}>/</Text>15
          </Text>
          <Text style={styles.tagline}>Micro-intervals that build your engine.</Text>
        </Animated.View>
        <View style={{ flex: 0.6 }} />
        {WELCOME_PHOTO ? null : (
        <Animated.View style={[styles.scene, { transform: [{ translateX: rollX }] }]}>
          <RoadBike width={bikeW} tone={BIKE_TONES.ember} wheelPeriodMs={reduce ? null : 900} />
        </Animated.View>
        )}
        <View style={styles.road}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,190,150,0)', 'rgba(255,190,150,0.55)', 'rgba(255,190,150,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.horizon}
          />
          <View style={{ marginTop: 14, opacity: 0.6 }}>
            <RoadStream width={width} periodMs={reduce ? null : 520} color="rgba(255,200,170,0.35)" />
          </View>
        </View>
        <View style={{ flex: 0.5 }} />
        <Pill label="Get started" variant="light" onPress={onDone} testID="welcome-start" style={styles.stretch} />
        {WELCOME_PHOTO ? <Text style={styles.credit}>{WELCOME_PHOTO.credit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, height: '70%', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  credit: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 14 },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  dusk: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 480 },
  horizon: { height: 1, alignSelf: 'stretch' },
  scene: { alignItems: 'center', marginBottom: -6 },
  road: { alignSelf: 'stretch', marginHorizontal: -24 },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 72 },
  word: { marginTop: 36, color: ink.text, fontSize: 76, lineHeight: 80, fontWeight: '700', letterSpacing: -3.5, fontVariant: ['tabular-nums'] },
  tagline: { marginTop: 16, color: '#A8A8AE', fontSize: 21, lineHeight: 28, textAlign: 'center', maxWidth: 260 },
  stretch: { alignSelf: 'stretch' },
});
