import type { ImageSourcePropType } from 'react-native';

/**
 * Photos shown on the welcome screen and the Why 30/15 sheet.
 *
 * None ship today: the app uses only artwork made for it, so nothing needs a
 * third-party licence or an on-screen credit. To add one later, use an image
 * you own outright (commissioned, your own photo, or generated under a
 * commercial licence), set it here, and leave `credit` empty unless its
 * licence asks for one.
 */
export type Photo = { source: ImageSourcePropType; credit?: string; url?: string };

export const WELCOME_PHOTO: Photo | null = null;

export const WHY_PHOTO: Photo | null = null;
