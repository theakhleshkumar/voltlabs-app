/**
 * BLE Connection Manager
 * Stores BleManager instance and connected device to avoid
 * passing non-serializable objects through navigation params
 */

let bleManagerInstance = null;
let connectedDevice = null;

export const BleConnectionManager = {
  /**
   * Set the BleManager instance
   */
  setBleManager(manager) {
    bleManagerInstance = manager;
  },

  /**
   * Get the BleManager instance
   */
  getBleManager() {
    return bleManagerInstance;
  },

  /**
   * Store connected device
   */
  setConnectedDevice(device) {
    connectedDevice = device;
  },

  /**
   * Get connected device
   */
  getConnectedDevice() {
    return connectedDevice;
  },

  /**
   * Clear stored device (call after disconnect or provisioning complete)
   */
  clearConnectedDevice() {
    connectedDevice = null;
  },

  /**
   * Clear all (call on cleanup)
   */
  clearAll() {
    bleManagerInstance = null;
    connectedDevice = null;
  },
};
