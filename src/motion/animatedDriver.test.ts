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

test('the pause control renders those three hosts instead of one mixed text node', () => {
  const source = readFileSync('src/screens/ActiveScreen.tsx', 'utf8');
  const block = source.slice(source.indexOf('function PauseResume'), source.indexOf('function FinishTitle'));
  assert.equal(block.includes('color: textColor, opacity: textOpacity'), false);
  assert.match(block, /style=\{\[styles\.pauseShell, motion\.shell\]\}/);
  assert.match(block, /style=\{motion\.fade\}/);
  assert.match(block, /style=\{\[styles\.pauseLabel, motion\.label\]\}/);
});

/**
 * Audited graphs for the rest of the active ride. Each host is one animated
 * component. Phase color is a plain string on its own layer, not a binding.
 */
const activeRide: AnimatedHost[] = [
  {
    id: 'transport',
    bindings: [
      { value: 'open', props: ['opacity'], driver: 'native' },
      { value: 'open', props: ['transform'], driver: 'native' },
    ],
  },
  {
    id: 'finish-title',
    bindings: [
      { value: 'opacity', props: ['opacity'], driver: 'native' },
      { value: 'scale', props: ['transform'], driver: 'native' },
    ],
  },
  {
    id: 'atmosphere-breath',
    bindings: [
      { value: 'breath', props: ['opacity'], driver: 'native' },
      { value: 'breath', props: ['transform'], driver: 'native' },
    ],
  },
  { id: 'atmosphere-phase-a', bindings: [{ value: 'aOpacity', props: ['opacity'], driver: 'native' }] },
  { id: 'atmosphere-phase-b', bindings: [{ value: 'bOpacity', props: ['opacity'], driver: 'native' }] },
  {
    id: 'atmosphere-burst',
    bindings: [
      { value: 'burst', props: ['opacity'], driver: 'native' },
      { value: 'burst', props: ['transform'], driver: 'native' },
    ],
  },
  { id: 'rail-fill', bindings: [{ value: 'width', props: ['width'], driver: 'js' }] },
  { id: 'rail-head', bindings: [{ value: 'life', props: ['opacity'], driver: 'native' }] },
  { id: 'rail-flash', bindings: [{ value: 'hit', props: ['opacity'], driver: 'native' }] },
  {
    id: 'digit',
    bindings: [
      { value: 'opacity', props: ['opacity'], driver: 'native' },
      { value: 'shift', props: ['transform'], driver: 'native' },
    ],
  },
  { id: 'clock', bindings: [{ value: 'scale', props: ['transform'], driver: 'native' }] },
  { id: 'phase-label', bindings: [{ value: 'opacity', props: ['opacity'], driver: 'native' }] },
];

test('the rest of the active ride does not mix drivers on one node', () => {
  assert.deepEqual(driverConflicts(activeRide), []);
  assert.equal(valuesPromotedToNative(activeRide, 'life').includes('width'), false);
  assert.equal(valuesPromotedToNative(activeRide, 'breath').includes('aOpacity'), false);
  assert.deepEqual(driverConflicts(activeRide.map((host) => ({ ...host, bindings: host.bindings.map((binding) => ({ ...binding, driver: 'js' as const })) }))), []);
});
