import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

/** Portrait dusk road and a road bike. The welcome glass sits on top of this. */
export function BikeHero() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#2C333C', '#8E8A86', '#E4C2A4', '#C9B4A4', '#6E655E']}
        locations={[0, 0.28, 0.46, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgGradient id="fog" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F3E6D8" stopOpacity="0" />
            <Stop offset="1" stopColor="#E7D5C4" stopOpacity="0.55" />
          </SvgGradient>
        </Defs>
        <Path d="M0 430 C70 390 120 470 190 440 C270 406 320 360 390 390 L390 560 L0 560 Z" fill="#8C8178" />
        <Path d="M0 470 C90 430 150 500 230 470 C300 446 340 420 390 450 L390 600 L0 620 Z" fill="#6A625C" />
        <Ellipse cx="200" cy="500" rx="220" ry="46" fill="url(#fog)" />
        <Path
          d="M-40 860 L120 520 C150 490 176 478 210 490 C250 506 300 560 430 620 L430 900 Z"
          fill="#2A2C30"
        />
        <Path
          d="M-20 860 L132 534 C158 508 176 498 198 508"
          fill="none"
          stroke="#F4F1EC"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path d="M70 700 C120 640 150 600 168 560" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
        <G transform="translate(168,548)">
          <Circle cx="36" cy="78" r="48" fill="#141414" />
          <Circle cx="36" cy="78" r="40" fill="none" stroke="#2A2A2A" strokeWidth="3" />
          <Circle cx="36" cy="78" r="7" fill="#3A3A3A" />
          <Circle cx="168" cy="70" r="48" fill="#141414" />
          <Circle cx="168" cy="70" r="40" fill="none" stroke="#2A2A2A" strokeWidth="3" />
          <Circle cx="168" cy="70" r="7" fill="#3A3A3A" />
          <Path
            d="M36 78 L92 78 L78 18 L128 28 L168 70 M78 18 L128 28 M92 78 L128 28"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path d="M70 16 H96" stroke="#111" strokeWidth="6" strokeLinecap="round" />
          <Path d="M124 26 C146 8 162 8 170 22 C160 28 148 30 136 28" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          <Path d="M92 78 L78 108" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          <Circle cx="92" cy="78" r="9" fill="none" stroke="#222" strokeWidth="3" />
        </G>
        <Path d="M0 760 L390 700 L390 844 L0 844 Z" fill="rgba(0,0,0,0.28)" />
      </Svg>
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
