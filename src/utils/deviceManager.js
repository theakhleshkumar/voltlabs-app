/**
 * Device Manager
 * Handles device identification and trusted device token storage
 * for skip-OTP login on returning users with same device
 */

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import secureStorage from './secureStorage';

const STORAGE_KEYS = {
  DEVICE_ID: '@voltlabs_device_id',
  DEVICE_TOKEN: '@voltlabs_device_token',
  TRUSTED_PHONE: '@voltlabs_trusted_phone',
};

class DeviceManager {
  constructor() {
    this.deviceId = null;
    this.deviceToken = null;
    this.trustedPhone = null;
  }

  /**
   * Initialize device manager - call on app startup
   */
  async init() {
    try {
      // Get or generate device ID
      this.deviceId = await this.getOrCreateDeviceId();
      
      // Load stored trusted device info
      this.deviceToken = await secureStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
      this.trustedPhone = await secureStorage.getItem(STORAGE_KEYS.TRUSTED_PHONE);
      
      console.log('[DeviceManager] Initialized:', {
        deviceId: this.deviceId,
        hasTrustedToken: !!this.deviceToken,
        trustedPhone: this.trustedPhone ? this.trustedPhone.slice(0, -4) + '****' : null,
      });
      
      return true;
    } catch (error) {
      console.error('[DeviceManager] Init error:', error);
      return false;
    }
  }

  /**
   * Get or create a unique device ID
   */
  async getOrCreateDeviceId() {
    try {
      // First try to get stored device ID
      let storedId = await secureStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (storedId) {
        return storedId;
      }

      // Generate new device ID using device info
      const uniqueId = await DeviceInfo.getUniqueId();
      const deviceId = `${Platform.OS}_${uniqueId}`;

      // Store for future use
      await secureStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);

      return deviceId;
    } catch (error) {
      console.error('[DeviceManager] Error getting device ID:', error);
      // Fallback to random ID
      const fallbackId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await secureStorage.setItem(STORAGE_KEYS.DEVICE_ID, fallbackId);
      return fallbackId;
    }
  }

  /**
   * Get device name for display
   */
  async getDeviceName() {
    try {
      const deviceName = await DeviceInfo.getDeviceName();
      const model = DeviceInfo.getModel();
      return deviceName || model || 'Unknown Device';
    } catch (error) {
      return 'Unknown Device';
    }
  }

  /**
   * Check if this device is trusted for a phone number
   * @param {string} phone - Phone number to check
   * @returns {boolean}
   */
  isTrustedForPhone(phone) {
    return this.deviceToken && this.trustedPhone === phone;
  }

  /**
   * Check if device has any trusted credentials
   * @returns {{phone: string, deviceToken: string, deviceId: string} | null}
   */
  getTrustedCredentials() {
    if (this.deviceToken && this.trustedPhone && this.deviceId) {
      return {
        phone: this.trustedPhone,
        deviceToken: this.deviceToken,
        deviceId: this.deviceId,
      };
    }
    return null;
  }

  /**
   * Save trusted device credentials after successful OTP verification
   * @param {string} phone - Verified phone number
   * @param {string} deviceToken - Token from server
   */
  async saveTrustedDevice(phone, deviceToken) {
    try {
      await secureStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, deviceToken);
      await secureStorage.setItem(STORAGE_KEYS.TRUSTED_PHONE, phone);
      
      this.deviceToken = deviceToken;
      this.trustedPhone = phone;
      
      console.log('[DeviceManager] Device trusted for:', phone.slice(0, -4) + '****');
      return true;
    } catch (error) {
      console.error('[DeviceManager] Error saving trusted device:', error);
      return false;
    }
  }

  /**
   * Clear trusted device credentials (e.g., on logout or token expiry)
   */
  async clearTrustedDevice() {
    try {
      await secureStorage.removeItems([
        STORAGE_KEYS.DEVICE_TOKEN,
        STORAGE_KEYS.TRUSTED_PHONE,
      ]);
      
      this.deviceToken = null;
      this.trustedPhone = null;
      
      console.log('[DeviceManager] Trusted device cleared');
      return true;
    } catch (error) {
      console.error('[DeviceManager] Error clearing trusted device:', error);
      return false;
    }
  }

  /**
   * Get device info for registration
   */
  async getDeviceInfo() {
    return {
      deviceId: this.deviceId,
      deviceName: await this.getDeviceName(),
      platform: Platform.OS,
    };
  }
}

// Export singleton instance
const deviceManager = new DeviceManager();
export default deviceManager;
