import { NativeModules, Platform } from 'react-native';

const { BluetoothModule } = NativeModules;

/**
 * Request to enable Bluetooth using Android's native Intent
 * This triggers the system dialog: "Allow app to turn on Bluetooth?"
 */
export const requestEnableBluetooth = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    // Try using the native module if available
    if (BluetoothModule && BluetoothModule.requestEnable) {
      return await BluetoothModule.requestEnable();
    }
    
    // Fallback: Return false to indicate native module not available
    console.log('BluetoothModule not available');
    return false;
  } catch (error) {
    console.error('Error requesting Bluetooth enable:', error);
    return false;
  }
};
