export class BleManager {
  constructor() {
    throw new Error('Bluetooth is not available in the browser.');
  }
}

export const State = { PoweredOn: 'PoweredOn' };
