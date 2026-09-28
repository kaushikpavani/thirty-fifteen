export function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function readS16(bytes: Uint8Array, offset: number): number {
  const value = readU16(bytes, offset);
  return value > 0x7fff ? value - 0x10000 : value;
}

export type PowerReading = {
  watts: number | null;
  speedKph: number | null;
};

/**
 * FTMS Indoor Bike Data (0x2AD2).
 * Bit 0 clear means instantaneous speed is present. Power is optional (bit 6).
 */
export function parseIndoorBikeData(bytes: Uint8Array): PowerReading | null {
  if (bytes.length < 2) return null;
  const flags = readU16(bytes, 0);
  let offset = 2;

  const take = (size: number): boolean => {
    if (offset + size > bytes.length) return false;
    offset += size;
    return true;
  };

  let speedKph: number | null = null;
  if ((flags & 0x0001) === 0) {
    if (offset + 2 > bytes.length) return null;
    speedKph = readU16(bytes, offset) / 100;
    offset += 2;
  }
  if (flags & 0x0002 && !take(2)) return null;
  if (flags & 0x0004 && !take(2)) return null;
  if (flags & 0x0008 && !take(2)) return null;
  if (flags & 0x0010 && !take(3)) return null;
  if (flags & 0x0020 && !take(2)) return null;

  let watts: number | null = null;
  if (flags & 0x0040) {
    if (offset + 2 > bytes.length) return null;
    watts = readS16(bytes, offset);
  }

  if (watts == null && speedKph == null) return null;
  return { watts, speedKph };
}

/**
 * Optional Cycling Power Measurement fields, in Bluetooth SIG order, after the
 * mandatory flags + sint16 watts. Presence bits 1 and 3 are references, not fields.
 */
const CPS_OPTIONAL: { bit: number; size: number }[] = [
  { bit: 0x0001, size: 1 }, // pedal power balance
  { bit: 0x0004, size: 2 }, // accumulated torque
  { bit: 0x0010, size: 6 }, // wheel revolution data
  { bit: 0x0020, size: 4 }, // crank revolution data
  { bit: 0x0040, size: 4 }, // extreme force magnitudes
  { bit: 0x0080, size: 4 }, // extreme torque magnitudes
  { bit: 0x0100, size: 3 }, // extreme angles
  { bit: 0x0200, size: 2 }, // top dead spot angle
  { bit: 0x0400, size: 2 }, // bottom dead spot angle
  { bit: 0x0800, size: 2 }, // accumulated energy
];

/**
 * Skip optional fields when they fit. A short packet still keeps the mandatory watts.
 * Never indexes past `bytes.length`.
 */
function walkCyclingPowerOptional(bytes: Uint8Array, flags: number): void {
  let offset = 4;
  for (const field of CPS_OPTIONAL) {
    if ((flags & field.bit) === 0) continue;
    if (offset + field.size > bytes.length) return;
    offset += field.size;
  }
}

/**
 * Cycling Power Measurement (0x2A63).
 * Bytes 0–1 are the flags. Bytes 2–3 are instantaneous power, sint16 little-endian.
 * That pair is mandatory and does not move when optional fields follow.
 * Packets shorter than 4 bytes are ignored. Longer or truncated packets do not throw.
 */
export function parseCyclingPower(bytes: Uint8Array | null | undefined): PowerReading | null {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] == null || bytes[1] == null || bytes[2] == null || bytes[3] == null) return null;
  const flags = readU16(bytes, 0);
  const watts = readS16(bytes, 2);
  walkCyclingPowerOptional(bytes, flags);
  return { watts, speedKph: null };
}

/**
 * Heart Rate Measurement (0x2A37).
 * Flags are byte 0. Bit 0 selects uint8 (byte 1) or uint16 LE (bytes 1–2).
 * When sensor contact is supported and not detected, there is no live beat.
 * 0 and out-of-range values are ignored so a quiet watch cannot look like a reading.
 */
export function parseHeartRate(bytes: Uint8Array | null | undefined): number | null {
  if (!bytes || bytes.length < 2 || bytes[0] == null || bytes[1] == null) return null;
  const flags = bytes[0];
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  if (contactSupported && !contactDetected) return null;
  const wide = (flags & 0x01) !== 0;
  if (wide && (bytes.length < 3 || bytes[2] == null)) return null;
  const bpm = wide ? readU16(bytes, 1) : bytes[1];
  if (!Number.isFinite(bpm) || bpm < 1 || bpm > 250) return null;
  return bpm;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}
