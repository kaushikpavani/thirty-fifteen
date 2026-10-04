import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { createMusicPreview, PREVIEW_MS, PREVIEW_VOLUME, type PreviewPlayer } from './musicPreview.ts';

function fakeFactory(opts: { failPlay?: boolean } = {}) {
  const made: (PreviewPlayer & { source: number; played: boolean; paused: boolean; removed: boolean; volumes: number[] })[] = [];
  const create = (source: number) => {
    const p = {
      source, played: false, paused: false, removed: false, volumes: [] as number[], loop: true,
      _v: 0,
      get volume() { return this._v; },
      set volume(v: number) { this._v = v; this.volumes.push(v); },
      play() { if (opts.failPlay) throw new Error('no audio'); this.played = true; },
      pause() { this.paused = true; },
      remove() { this.removed = true; },
    };
    made.push(p);
    return p;
  };
  return { made, create };
}

test('plays the track once at a sensible volume, then fades out and releases the player by itself', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const f = fakeFactory();
  const preview = createMusicPreview(f.create);
  assert.equal(preview.play(11), true);
  const p = f.made[0]!;
  assert.equal(p.source, 11);
  assert.equal(p.loop, false);
  assert.equal(p.played, true);
  assert.equal(p.volumes[0], PREVIEW_VOLUME);
  mock.timers.tick(PREVIEW_MS - 1600);
  assert.equal(preview.isPlaying(), true);
  assert.equal(p.volumes.at(-1), PREVIEW_VOLUME, 'full volume until the fade starts');
  mock.timers.tick(1000);
  assert.ok(p.volumes.at(-1)! < PREVIEW_VOLUME, 'fading');
  mock.timers.tick(700);
  assert.equal(preview.isPlaying(), false);
  assert.equal(p.removed, true);
  mock.timers.reset();
});

test('tapping another style replaces the preview: only one is ever playing', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const f = fakeFactory();
  const preview = createMusicPreview(f.create);
  preview.play(1);
  mock.timers.tick(2000);
  preview.play(2);
  assert.equal(f.made[0]!.removed, true);
  assert.equal(f.made[1]!.played, true);
  assert.equal(f.made.filter((p) => !p.removed).length, 1);
  mock.timers.tick(PREVIEW_MS);
  assert.equal(f.made.every((p) => p.removed), true);
  mock.timers.reset();
});

test('stop is immediate, and safe to call any number of times', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const f = fakeFactory();
  const preview = createMusicPreview(f.create);
  preview.stop();
  preview.play(3);
  preview.stop();
  preview.stop();
  assert.equal(f.made[0]!.paused, true);
  assert.equal(f.made[0]!.removed, true);
  assert.equal(preview.isPlaying(), false);
  mock.timers.reset();
});

test('nothing to play, or audio that fails, never throws and leaves nothing running', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const f = fakeFactory({ failPlay: true });
  const preview = createMusicPreview(f.create);
  assert.equal(preview.play(undefined), false);
  assert.equal(preview.play(4), false);
  assert.equal(preview.isPlaying(), false);
  assert.equal(f.made[0]!.removed, true);
  const broken = createMusicPreview(() => { throw new Error('player limit'); });
  assert.equal(broken.play(5), false);
  assert.equal(broken.isPlaying(), false);
  mock.timers.reset();
});
