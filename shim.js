/**
 * Node.js polyfills for React Native
 * Required for mqtt.js compatibility
 */

import { Buffer } from 'buffer';
import process from 'process';

// Set up global polyfills
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof global.process === 'undefined') {
  global.process = process;
}
