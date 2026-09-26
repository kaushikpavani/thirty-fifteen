import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../types';
import type { User } from '@supabase/supabase-js';
import { supabaseUrl } from './config';
import { mapAuthUser } from './mapUser';
import { storedSessionUser, supabaseAuthStorageKey } from './storageKey';

/** Last signed-in rider saved on this phone. Does not refresh tokens or call the network. */
export async function loadCachedAuthUser(): Promise<AuthUser | null> {
  try {
    const key = supabaseAuthStorageKey(supabaseUrl());
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    return mapAuthUser(storedSessionUser(raw) as User | null);
  } catch {
    return null;
  }
}
