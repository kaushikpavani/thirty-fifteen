import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'bolt'
  | 'heart'
  | 'sliders'
  | 'chevron'
  | 'back'
  | 'info'
  | 'pause'
  | 'play'
  | 'check'
  | 'person'
  | 'wave'
  | 'haptic'
  | 'target'
  | 'spinner'
  | 'speaker'
  | 'forward'
  | 'skip'
  | 'mail';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

/** One stroke family, drawn on a 24 grid. Filled glyphs where SF Symbols fill. */
export function Icon({ name, size = 20, color = '#F5F5F2', strokeWidth = 2 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M13.5 2 4 14h7l-1.5 8L19 10h-7z" fill={color} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 20.5S3 15 3 8.8C3 6.1 5.1 4 7.7 4c1.8 0 3.3 1 4.3 2.5C13 5 14.5 4 16.3 4 18.9 4 21 6.1 21 8.8 21 15 12 20.5 12 20.5z"
            fill={color}
          />
        </Svg>
      );
    case 'sliders':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...stroke} />
          <Circle cx="15" cy="7" r="2.2" {...stroke} />
          <Circle cx="9" cy="17" r="2.2" {...stroke} />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg width={(size * 8) / 14} height={size} viewBox="0 0 8 14">
          <Path d="M1.5 1.5 6.5 7l-5 5.5" {...stroke} strokeWidth={2.2} />
        </Svg>
      );
    case 'back':
      return (
        <Svg width={(size * 12) / 20} height={size} viewBox="0 0 12 20">
          <Path d="M10 2 2 10l8 8" {...stroke} strokeWidth={2.6} />
        </Svg>
      );
    case 'info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path d="M12 11v5M12 8h.01" {...stroke} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="5" y="3.5" width="5" height="17" rx="1.6" fill={color} />
          <Rect x="14" y="3.5" width="5" height="17" rx="1.6" fill={color} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={3} />
        </Svg>
      );
    case 'person':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="8" r="4" fill={color} />
          <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6z" fill={color} />
        </Svg>
      );
    case 'wave':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...stroke} strokeWidth={2.4} />
        </Svg>
      );
    case 'haptic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="8" y="3" width="8" height="18" rx="2" {...stroke} />
          <Path d="M4 9v6M20 9v6" {...stroke} />
        </Svg>
      );
    case 'target':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8" {...stroke} strokeWidth={2.5} />
          <Circle cx="12" cy="12" r="2.5" fill={color} />
        </Svg>
      );
    case 'spinner':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3a9 9 0 1 0 9 9" {...stroke} strokeWidth={3} />
        </Svg>
      );
    case 'forward':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 6.2v11.6a.8.8 0 0 0 1.2.7L12 13.2v4.6a.8.8 0 0 0 1.2.7l8.4-5.8a.8.8 0 0 0 0-1.4L13.2 5.5a.8.8 0 0 0-1.2.7v4.6L4.2 5.5A.8.8 0 0 0 3 6.2z" fill={color} />
        </Svg>
      );
    case 'skip':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 6.2v11.6a.8.8 0 0 0 1.2.7l8.4-5.8a.8.8 0 0 0 0-1.4L5.2 5.5A.8.8 0 0 0 4 6.2z" fill={color} />
          <Rect x="16" y="5" width="3.2" height="14" rx="1.2" fill={color} />
        </Svg>
      );
    case 'mail':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="5.5" width="18" height="13" rx="2.2" {...stroke} />
          <Path d="M4 7l8 6 8-6" {...stroke} />
        </Svg>
      );
    case 'speaker':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 9h4l5-4v14l-5-4H4z" fill={color} />
          <Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" {...stroke} />
        </Svg>
      );
  }
}
