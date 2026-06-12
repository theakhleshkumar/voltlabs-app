/**
 * @format
 */

// Import polyfills first - required for mqtt.js
import './shim';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
