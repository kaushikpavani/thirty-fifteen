import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesToHex, parseCyclingPower } from './parse.ts';

function packet(watts: number, flags = 0, extra: number[] = []): Uint8Array {
  const signed = watts < 0 ? watts + 0x10000 : watts;
  return Uint8Array.from([flags & 0xff, (flags >> 8) & 0xff, signed & 0xff, (signed >> 8) & 0xff, ...extra]);
}

const ALL_OPTIONAL = 0x0001 | 0x0004 | 0x0010 | 0x0020 | 0x0040 | 0x0080 | 0x0100 | 0x0200 | 0x0400 | 0x0800;

test('cycling power reads sint16 watts at bytes 2-3', () => {
  assert.deepEqual(parseCyclingPower(packet(150)), { watts: 150, speedKph: null });
  assert.equal(parseCyclingPower(packet(0))?.watts, 0);
  assert.equal(parseCyclingPower(packet(32767))?.watts, 32767);
  assert.equal(parseCyclingPower(packet(-1))?.watts, -1);
  assert.equal(parseCyclingPower(packet(-32768))?.watts, -32768);
});

test('optional fields do not move instantaneous watts', () => {
  assert.equal(parseCyclingPower(packet(186, 0x0020, [0x10, 0x00, 0x20, 0x00]))?.watts, 186);
  assert.equal(parseCyclingPower(packet(186, 0x0020, [0x10, 0x00, 0x20, 0x00]))?.speedKph, null);
  assert.equal(parseCyclingPower(packet(10, 0x0000, [0xe8, 0x03]))?.watts, 10);
  const full = packet(250, ALL_OPTIONAL, Array.from({ length: 30 }, () => 0));
  assert.equal(full.length, 34);
  assert.equal(parseCyclingPower(full)?.watts, 250);
});

test('short and truncated packets do not throw', () => {
  for (const length of [0, 1, 2, 3]) {
    assert.equal(parseCyclingPower(new Uint8Array(length)), null);
  }
  assert.equal(parseCyclingPower(null), null);
  assert.equal(parseCyclingPower(undefined), null);
  assert.doesNotThrow(() => parseCyclingPower(packet(300, ALL_OPTIONAL)));
  assert.equal(parseCyclingPower(packet(300, ALL_OPTIONAL))?.watts, 300);
  assert.doesNotThrow(() => parseCyclingPower(packet(200, 0x0020, [0x01, 0x00])));
  assert.equal(parseCyclingPower(packet(200, 0x0020, [0x01, 0x00]))?.watts, 200);
  assert.doesNotThrow(() => parseCyclingPower(packet(175, 0xffff, [0x01])));
  assert.equal(parseCyclingPower(packet(175, 0xffff, [0x01]))?.watts, 175);
});

test('rx bytes format as hex without separators', () => {
  assert.equal(bytesToHex(Uint8Array.from([0x00, 0x00, 0x96, 0x00])), '00009600');
  assert.equal(bytesToHex(new Uint8Array()), '');
});
