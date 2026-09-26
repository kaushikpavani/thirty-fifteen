/**
 * One animated value, and one host view, can only use one driver.
 * A native animation promotes every animated value on that host. The next JS
 * animation on a promoted value throws.
 */

export type AnimatedDriver = 'js' | 'native';

export type AnimatedProp = 'opacity' | 'transform' | 'backgroundColor' | 'borderColor' | 'color' | 'width';

export type AnimatedBinding = {
  value: string;
  props: readonly AnimatedProp[];
  driver: AnimatedDriver;
};

export type AnimatedHost = {
  id: string;
  bindings: readonly AnimatedBinding[];
};

const NATIVE_PROPS = new Set<AnimatedProp>(['opacity', 'transform']);

export function driverConflicts(hosts: readonly AnimatedHost[]): string[] {
  const conflicts: string[] = [];
  const valueDriver = new Map<string, AnimatedDriver>();

  for (const host of hosts) {
    let hostDriver: AnimatedDriver | null = null;
    for (const binding of host.bindings) {
      if (hostDriver == null) hostDriver = binding.driver;
      else if (hostDriver !== binding.driver) {
        conflicts.push(`${host.id} mixes ${hostDriver} and ${binding.driver} drivers`);
      }

      const previous = valueDriver.get(binding.value);
      if (previous == null) valueDriver.set(binding.value, binding.driver);
      else if (previous !== binding.driver) {
        conflicts.push(`${binding.value} uses both ${previous} and ${binding.driver} drivers`);
      }

      if (binding.driver === 'native') {
        for (const prop of binding.props) {
          if (!NATIVE_PROPS.has(prop)) conflicts.push(`${host.id} animates ${prop} on the native driver`);
        }
      }
    }
  }

  return conflicts;
}

/** Values a native start on `value` promotes, including `value` itself. */
export function valuesPromotedToNative(hosts: readonly AnimatedHost[], value: string): string[] {
  const promoted = new Set<string>();
  for (const host of hosts) {
    const startsNative = host.bindings.some((binding) => binding.value === value && binding.driver === 'native');
    if (!startsNative) continue;
    for (const binding of host.bindings) promoted.add(binding.value);
  }
  return [...promoted];
}

/**
 * Pause/Resume. `fill` interpolates color, so it stays on the JS driver.
 * The label fade is opacity and may use the native driver, on its own host.
 */
export function pauseResumeHosts(nativeMotion: boolean): AnimatedHost[] {
  const opacity: AnimatedDriver = nativeMotion ? 'native' : 'js';
  return [
    {
      id: 'shell',
      bindings: [{ value: 'fill', props: ['backgroundColor', 'borderColor'], driver: 'js' }],
    },
    {
      id: 'fade',
      bindings: [{ value: 'textOpacity', props: ['opacity'], driver: opacity }],
    },
    {
      id: 'label',
      bindings: [{ value: 'fill', props: ['color'], driver: 'js' }],
    },
  ];
}

export function pauseResumeDrivers(nativeMotion: boolean): { fill: boolean; textOpacity: boolean } {
  const hosts = pauseResumeHosts(nativeMotion);
  const native = (name: string) =>
    hosts.some((host) => host.bindings.some((binding) => binding.value === name && binding.driver === 'native'));
  return {
    fill: native('fill'),
    textOpacity: native('textOpacity'),
  };
}

export function pauseResumeSlots<TColor, TOpacity>(input: {
  backgroundColor: TColor;
  borderColor: TColor;
  textColor: TColor;
  textOpacity: TOpacity;
}): {
  shell: { backgroundColor: TColor; borderColor: TColor };
  fade: { opacity: TOpacity };
  label: { color: TColor };
} {
  return {
    shell: { backgroundColor: input.backgroundColor, borderColor: input.borderColor },
    fade: { opacity: input.textOpacity },
    label: { color: input.textColor },
  };
}
