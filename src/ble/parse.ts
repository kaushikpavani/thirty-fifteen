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

/** Cycling Power Measurement (0x2A63). Instantaneous power always follows the flags. */
export function parseCyclingPower(bytes: Uint8Array): PowerReading | null {
  if (bytes.length < 4) return null;
  return { watts: readS16(bytes, 2), speedKph: null };
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}
