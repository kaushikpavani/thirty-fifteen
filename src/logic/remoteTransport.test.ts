import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_REMOTE_STATE,
  isSuppressedEcho,
  reduceRemoteTransport,
  type RemoteState,
} from '../audio/remoteTransport.ts';

function step(state: RemoteState, playing: boolean, extra?: { didJustFinish?: boolean; echo?: boolean }) {
  return reduceRemoteTransport(state, { playing, didJustFinish: extra?.didJustFinish }, extra?.echo === true);
}

test('startup adopts the sample and does not emit play', () => {
  const first = step(INITIAL_REMOTE_STATE, true);
  assert.equal(first.intent, null);
  assert.equal(first.state.previous, true);
});

test('one paused sample pauses, and a second does not', () => {
  const playing = step(INITIAL_REMOTE_STATE, true).state;
  const paused = step(playing, false);
  assert.equal(paused.intent, 'pause');
  assert.equal(paused.state.previous, false);
  assert.equal(step(paused.state, false).intent, null);
});

test('one playing sample does not resume; the next tick does', () => {
  const paused = step(step(INITIAL_REMOTE_STATE, true).state, false).state;
  const edge = step(paused, true);
  assert.equal(edge.intent, null);
  assert.equal(edge.state.pending, true);
  const confirmed = step(edge.state, true);
  assert.equal(confirmed.intent, 'play');
  assert.equal(confirmed.state.previous, true);
});

test('a one-tick play blip does not resume', () => {
  const paused = step(step(INITIAL_REMOTE_STATE, true).state, false).state;
  const edge = step(paused, true);
  const back = step(edge.state, false);
  assert.equal(edge.intent, null);
  assert.equal(back.intent, null);
  assert.equal(back.state.previous, false);
});

test('didJustFinish does not pause or move the previous flag', () => {
  const playing = step(INITIAL_REMOTE_STATE, true).state;
  const finished = step(playing, false, { didJustFinish: true });
  assert.equal(finished.intent, null);
  assert.equal(finished.state.previous, true);
  assert.equal(finished.state.pending, null);
});

test('our own echo is adopted, and a contradicting pause still lands', () => {
  const playing = step(INITIAL_REMOTE_STATE, true).state;
  const echo = step(playing, false, { echo: true });
  assert.equal(echo.intent, null);
  assert.equal(echo.state.previous, false);

  const rider = step(playing, false, { echo: false });
  assert.equal(rider.intent, 'pause');
});

test('echo matches only the command we just issued, and only until the deadline', () => {
  assert.equal(isSuppressedEcho(1_000, 1_800, false, false), true);
  assert.equal(isSuppressedEcho(1_000, 1_800, false, true), false);
  assert.equal(isSuppressedEcho(1_800, 1_800, false, false), false);
  assert.equal(isSuppressedEcho(1_000, 1_800, null, false), false);
});
