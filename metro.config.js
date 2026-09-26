const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const bleEntry = path.join(
  __dirname,
  'node_modules/react-native-ble-plx/lib/module/index.js',
);
const bleWebStub = path.join(__dirname, 'src/ble/blePlx.web.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-ble-plx') {
    return {
      type: 'sourceFile',
      filePath: platform === 'web' ? bleWebStub : bleEntry,
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
