import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@thirtyfifteen/rider_name/v1';

export async function loadLocalName(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const name = raw?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
}

export async function saveLocalName(name: string | null): Promise<void> {
  try {
    if (!name) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, name);
  } catch {
    // ignore
  }
}
