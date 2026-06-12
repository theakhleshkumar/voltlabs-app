/**
 * Secure Storage
 * Thin wrapper around react-native-keychain (iOS Keychain / Android Keystore)
 * exposing the same get/set/remove shape as AsyncStorage, so it's a drop-in
 * replacement for sensitive values (tokens, trusted-device credentials).
 */

import * as Keychain from 'react-native-keychain';

// Keychain entries are username/password pairs - we only care about the
// "password" half, so use a fixed placeholder username for every entry.
const PLACEHOLDER_USERNAME = 'voltlabs';

export async function setItem(key, value) {
  await Keychain.setGenericPassword(PLACEHOLDER_USERNAME, value, { service: key });
}

export async function getItem(key) {
  const result = await Keychain.getGenericPassword({ service: key });
  return result ? result.password : null;
}

export async function removeItem(key) {
  await Keychain.resetGenericPassword({ service: key });
}

export async function removeItems(keys) {
  await Promise.all(keys.map(removeItem));
}

export default { setItem, getItem, removeItem, removeItems };
