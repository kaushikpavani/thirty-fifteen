import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  driverConflicts,
  pauseResumeDrivers,
  pauseResumeHosts,
  pauseResumeSlots,
  valuesPromotedToNative,
  type AnimatedHost,
} from './animatedDriver.ts';

/** The host that crashed: JS color and native opacity on one Animated.Text. */
const mixedPauseLabel: AnimatedHost[] = [
  {
    id: 'label',
    bindings: [
      { value: 'fill', props: ['color'], driver: 'js' },
      { value: 'textOpacity', props: ['opacity'], driver: 'native' },
    ],
  },
];

test('a native fade on the color label promotes fill and the next JS timing throws', () => {
  assert.deepEqual(valuesPromotedToNative(mixedPauseLabel, 'textOpacity'), ['fill', 'textOpacity']);
  assert.ok(driverConflicts(mixedPauseLabel).some((line) => line.includes('label mixes')));
});

test('pause then resume keeps the color timing on a JS node', () => {
  const hosts = pauseResumeHosts(true);
  assert.deepEqual(driverConflicts(hosts), []);
  assert.deepEqual(valuesPromotedToNative(hosts, 'textOpacity'), ['textOpacity']);
  assert.equal(valuesPromotedToNative(hosts, 'textOpacity').includes('fill'), false);
  assert.deepEqual(pauseResumeDrivers(true), { fill: false, textOpacity: true });
  assert.deepEqual(pauseResumeDrivers(false), { fill: false, textOpacity: false });
  assert.deepEqual(driverConflicts(pauseResumeHosts(false)), []);
});

test('color and the opacity fade are different style objects', () => {
  const slots = pauseResumeSlots({
    backgroundColor: 'fill',
    borderColor: 'fill',
    textColor: 'fill',
    textOpacity: 'textOpacity',
  });
  assert.deepEqual(slots.shell, { backgroundColor: 'fill', borderColor: 'fill' });
  assert.deepEqual(slots.fade, { opacity: 'textOpacity' });
  assert.deepEqual(slots.label, { color: 'fill' });
  assert.equal('opacity' in slots.label, false);
  assert.equal('color' in slots.fade, false);
  assert.equal('opacity' in slots.shell, false);
});

test('hold-to-end animates width on the JS driver only; the pause glass has no animated color', () => {
  const source = readFileSync('src/components/ride/Controls.tsx', 'utf8');
  const hold = source.slice(source.indexOf('export function HoldToEnd'), source.indexOf('export function StatTriplet'));
  assert.equal(/useNativeDriver: true|useNativeDriver: native/.test(hold), false);
  assert.match(hold, /useNativeDriver: false/);
  const glass = source.slice(source.indexOf('export function PauseGlass'), source.indexOf('export function HoldToEnd'));
  assert.equal(/interpolate/.test(glass), false);
});

/**
 * Audited graphs for the rest of the active ride. Each host is one animated
 * component. Phase color is a plain string on its own layer, not a binding.
 */
const activeRide: AnimatedHost[] = [
  { id: 'field-fade', bindings: [{ value: 'fade', props: ['opacity'], driver: 'native' }] },
  { id: 'field-shade', bindings: [{ value: 'shade', props: ['transform'], driver: 'native' }] },
  { id: 'field-rise', bindings: [{ value: 'riseValue', props: ['transform'], driver: 'native' }] },
  {
    id: 'phase-word',
    bindings: [
      { value: 'o', props: ['opacity'], driver: 'native' },
      { value: 'y', props: ['transform'], driver: 'native' },
    ],
  },
  { id: 'count-in', bindings: [{ value: 'scale', props: ['transform'], driver: 'native' }] },
  { id: 'press-scale', bindings: [{ value: 'pressScale', props: ['transform'], driver: 'native' }] },
  { id: 'hold-fill', bindings: [{ value: 'fill', props: ['width'], driver: 'js' }] },
  {
    id: 'finish-title',
    bindings: [
      { value: 'rise', props: ['opacity'], driver: 'native' },
      { value: 'rise', props: ['transform'], driver: 'native' },
    ],
  },
];

test('the rest of the active ride does not mix drivers on one node', () => {
  assert.deepEqual(driverConflicts(activeRide), []);
  assert.equal(valuesPromotedToNative(activeRide, 'fill').includes('width'), false);
  assert.equal(valuesPromotedToNative(activeRide, 'fade').includes('shade'), false);
  assert.deepEqual(driverConflicts(activeRide.map((host) => ({ ...host, bindings: host.bindings.map((binding) => ({ ...binding, driver: 'js' as const })) }))), []);
});
