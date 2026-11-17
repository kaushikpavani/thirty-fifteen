import { AndroidConfig, type ConfigPlugin, withAndroidManifest, withAndroidStyles } from 'expo/config-plugins';
// Plain JS on purpose. Expo compiles this plugin to CJS and does not resolve a `.ts` import.
import { shapeAndroidReleaseManifest, shapeAndroidSystemBars } from './androidManifest.js';

/** Android manifest and system bars. Does not touch the iOS project. */
const withAndroidRelease: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (next) => {
    next.modResults = shapeAndroidReleaseManifest(next.modResults);
    return next;
  });
  config = withAndroidStyles(config, (next) => {
    next.modResults = shapeAndroidSystemBars(
      next.modResults,
      (xml: Parameters<typeof AndroidConfig.Styles.assignStylesValue>[0], spec: Parameters<typeof AndroidConfig.Styles.assignStylesValue>[1]) =>
        AndroidConfig.Styles.assignStylesValue(xml, spec),
      AndroidConfig.Styles.getAppThemeGroup(),
    );
    return next;
  });
  return config;
};

export default withAndroidRelease;
