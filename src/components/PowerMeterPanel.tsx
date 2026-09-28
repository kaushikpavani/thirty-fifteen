import React from 'react';
import { usePowerMeter } from '../state/PowerMeterContext';
import { SensorPanel } from './SensorPanel';

/** Power meter connect list. The running ride never mounts this. */
export function PowerMeterPanel({ variant: _variant }: { variant: 'settings' }) {
  const meter = usePowerMeter();
  const live = meter.live ? `Live · ${meter.live.watts} W${meter.live.speedKph != null ? ` · ${meter.live.speedKph.toFixed(1)} km/h` : ''}` : null;
  return <SensorPanel kind="power" api={meter} live={live} testPrefix="power-meter" />;
}
