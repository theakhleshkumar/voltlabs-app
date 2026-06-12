const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      assets: path.resolve(__dirname, 'src/assets'),
      // Node.js polyfills for mqtt.js
      stream: require.resolve('readable-stream'),
      buffer: require.resolve('buffer'),
      events: require.resolve('events'),
      process: require.resolve('process/browser'),
      url: require.resolve('url'),
    },
  },
  watchFolders: [path.resolve(__dirname, 'src')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
