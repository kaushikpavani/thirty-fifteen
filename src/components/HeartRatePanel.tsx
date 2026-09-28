import React from 'react';
import { useHeartRate } from '../state/HeartRateContext';
import { SensorPanel } from './SensorPanel';

/** Heart rate connect list. The ride reads beats from context and never invents them. */
export function HeartRatePanel() {
  const heart = useHeartRate();
  const live = heart.live ? `Live · ${heart.live.bpm} bpm` : null;
  return <SensorPanel kind="heart" api={heart} live={live} testPrefix="heart-rate" />;
}
