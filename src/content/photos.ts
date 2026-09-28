import type { ImageSourcePropType } from 'react-native';

/**
 * Licensed photos. Each needs its credit on screen and in Settings → Credits.
 * Files are graded to the Carbon & Ember palette from the originals.
 */
export type Photo = { source: ImageSourcePropType; credit: string; url: string };

export const WELCOME_PHOTO: Photo | null = {
  source: require('../../assets/photos/welcome-road.jpg'),
  credit: 'Photo: Marco Guidi · Vecteezy',
  url: 'https://www.vecteezy.com/photo/27082148-a-man-riding-a-bike',
};

export const WHY_PHOTO: Photo | null = {
  source: require('../../assets/photos/why-climb.jpg'),
  credit: 'Photo: Erwin Pieloor · Vecteezy (AI-generated)',
  url: 'https://www.vecteezy.com/photo/74210911-dedicated-male-cyclist-wearing-black-gear-aggressively',
};
