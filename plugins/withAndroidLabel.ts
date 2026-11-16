import { AndroidConfig, type ConfigPlugin, withStringsXml } from 'expo/config-plugins';

/** Android launcher label. `expo.name` is the Xcode target, not the home-screen string. */
const withAndroidLabel: ConfigPlugin<string> = (config, label) => {
  if (typeof label !== 'string' || label.length === 0) {
    throw new Error('withAndroidLabel requires the Android launcher label.');
  }
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: label })],
      config.modResults,
    );
    return config;
  });
};

export default withAndroidLabel;
