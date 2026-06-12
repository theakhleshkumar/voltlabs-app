import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request BLE permissions based on Android version
 *
 * Returns one of:
 * - 'granted' → all required permissions granted
 * - 'denied'  → permissions denied but retry possible
 * - 'blocked' → permissions permanently denied (NEVER_ASK_AGAIN)
 */
export const requestBlePermissions = async () => {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  try {
    const androidVersion = Platform.Version;

    // ANDROID 12+ (API 31+)
    if (androidVersion >= 31) {
    // Ask for permissions (dialog may or may not appear)
    await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    // VERIFY actual permission state (this is critical)
    const hasScan = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
    );

    const hasConnect = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );

    // ✅ Only proceed if BOTH are truly granted
    if (hasScan && hasConnect) {
        return 'granted'; 
    }

    // 🚫 Permission denied or blocked
    return 'blocked';
    }


    // ANDROID 11 AND BELOW (API ≤30)
    const locationResult = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    if (locationResult === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }

    if (locationResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return 'blocked';
    }

    return 'denied';
  } catch (error) {
    console.error('Error requesting BLE permissions:', error);
    return 'denied';
  }
};

/**
 * Check if BLE permissions are already granted (without requesting)
 * Returns true if all required permissions are granted, false otherwise
 */
export const checkBlePermissions = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const androidVersion = Platform.Version;

    // ANDROID 12+ (API 31+)
    if (androidVersion >= 31) {
      const hasScan = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      const hasConnect = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      return hasScan && hasConnect;
    }

    // ANDROID 11 AND BELOW (API ≤30)
    const hasLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return hasLocation;
  } catch (error) {
    console.error('Error checking BLE permissions:', error);
    return false;
  }
};
