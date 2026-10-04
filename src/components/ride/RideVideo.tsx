import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * The rider loop on the ride screen: a muted, looping clip in a rounded
 * window. It never makes a sound and never takes the audio session from the
 * coach or the music (mixWithOthers, muted). With Reduce Motion on it shows
 * a still frame instead of moving. Any failure just leaves the window empty;
 * the ride is unaffected.
 */
export function RideVideo({ source, still = false, style }: { source: number; still?: boolean; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(source, (p) => {
    try {
      p.loop = true;
      p.muted = true;
      p.audioMixingMode = 'mixWithOthers';
      if (!still) p.play();
    } catch {
      // The window stays empty.
    }
  });

  useEffect(() => {
    try {
      if (still) player.pause();
      else player.play();
    } catch {
      // ignore
    }
  }, [player, still]);

  return (
    <View style={[styles.window, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  window: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
});
