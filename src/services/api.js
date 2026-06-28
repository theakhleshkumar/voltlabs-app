/**
 * API Service for VoltLabs Backend
 * Handles all HTTP requests to the backend
 */

import secureStorage from '../utils/secureStorage';
import deviceManager from '../utils/deviceManager';

// API Configuration
// __DEV__ is true for debug builds, false for release builds (Play Store/App Store).
const API_CONFIG = {
  // Local dev server (physical device on same LAN): 'http://YOUR_LOCAL_IP:3000/api'
  // Android emulator only: 'http://10.0.2.2:3000/api'
  baseUrl: __DEV__
    ? 'http://192.168.1.5:3000/api'
    : 'https://voltlabs-app.onrender.com/api',
  // 30s to tolerate Render free-tier cold starts on the production backend
  timeout: 30000,
};

// Token storage keys
const TOKEN_KEYS = {
  accessToken: '@voltlabs_access_token',
  refreshToken: '@voltlabs_refresh_token',
  user: '@voltlabs_user',
};

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.sessionExpiredListeners = [];
  }

  /**
   * Subscribe to "session expired" events (refresh token invalid/expired).
   * Used by AuthContext to drop the app back to the login flow.
   */
  onSessionExpired(callback) {
    this.sessionExpiredListeners.push(callback);
  }

  offSessionExpired(callback) {
    this.sessionExpiredListeners = this.sessionExpiredListeners.filter(cb => cb !== callback);
  }

  notifySessionExpired() {
    this.sessionExpiredListeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[API] Session expired callback error:', error);
      }
    });
  }

  /**
   * Initialize API service - load tokens from storage
   */
  async init() {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        secureStorage.getItem(TOKEN_KEYS.accessToken),
        secureStorage.getItem(TOKEN_KEYS.refreshToken),
        secureStorage.getItem(TOKEN_KEYS.user),
      ]);

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.user = userJson ? JSON.parse(userJson) : null;
      
      return this.isAuthenticated();
    } catch (error) {
      console.error('[API] Init error:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Save tokens to storage
   */
  async saveTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    
    await Promise.all([
      secureStorage.setItem(TOKEN_KEYS.accessToken, accessToken),
      refreshToken ? secureStorage.setItem(TOKEN_KEYS.refreshToken, refreshToken) : Promise.resolve(),
    ]);
  }

  /**
   * Save user to storage
   */
  async saveUser(user) {
    this.user = user;
    await secureStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
  }

  /**
   * Clear all auth data
   */
  async clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    
    await secureStorage.removeItems([
      TOKEN_KEYS.accessToken,
      TOKEN_KEYS.refreshToken,
      TOKEN_KEYS.user,
    ]);
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth header if token exists
    if (this.accessToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && !options.skipAuth && !options.isRetry) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry request with new token
            return this.request(endpoint, { ...options, isRetry: true });
          }
        }
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    // Prevent multiple refresh calls
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const data = await this.request('/auth/refresh-token', {
          method: 'POST',
          body: { refreshToken: this.refreshToken },
          skipAuth: true,
        });

        await this.saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
        return true;
      } catch (error) {
        console.error('[API] Token refresh failed:', error);
        await this.clearAuth();
        this.notifySessionExpired();
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ============ Auth Endpoints ============

  /**
   * Send OTP to phone number
   */
  async sendOtp(phone, countryCode = '+91') {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: { phone, countryCode },
      skipAuth: true,
    });
  }

  /**
   * Verify OTP and login
   */
  async verifyOtp(phone, otp, countryCode = '+91') {
    // Include device info to register as trusted device
    const deviceInfo = await deviceManager.getDeviceInfo();
    
    const data = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: { 
        phone, 
        otp, 
        countryCode,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
      },
      skipAuth: true,
    });

    if (data.success) {
      await this.saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await this.saveUser(data.user);
      
      // Save device token for future skip-OTP logins
      if (data.deviceToken) {
        const fullPhone = countryCode + phone.replace(/^0+/, '');
        await deviceManager.saveTrustedDevice(fullPhone, data.deviceToken);
      }
    }

    return data;
  }

  /**
   * Login with trusted device (skip OTP)
   * Returns success if device is trusted, or requireOtp: true if OTP needed
   */
  async deviceLogin() {
    const credentials = deviceManager.getTrustedCredentials();
    
    if (!credentials) {
      return { success: false, requireOtp: true, reason: 'No trusted credentials' };
    }
    
    try {
      const data = await this.request('/auth/device-login', {
        method: 'POST',
        body: {
          phone: credentials.phone,
          deviceId: credentials.deviceId,
          deviceToken: credentials.deviceToken,
        },
        skipAuth: true,
      });
      
      if (data.success) {
        await this.saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
        await this.saveUser(data.user);
      }
      
      return data;
    } catch (error) {
      // If device login fails, clear trusted credentials and require OTP
      if (error.message?.includes('not trusted') || error.message?.includes('expired')) {
        await deviceManager.clearTrustedDevice();
      }
      return { success: false, requireOtp: true, reason: error.message };
    }
  }

  /**
   * Request account deletion - sends an OTP to confirm intent
   */
  async requestAccountDeletion() {
    return this.request('/auth/request-account-deletion', {
      method: 'POST',
    });
  }

  /**
   * Confirm account deletion with the OTP sent by requestAccountDeletion()
   */
  async confirmAccountDeletion(otp) {
    return this.request('/auth/confirm-account-deletion', {
      method: 'POST',
      body: { otp },
    });
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: { refreshToken: this.refreshToken },
      });
    } catch (error) {
      console.log('[API] Logout request error (ignored):', error);
    }
    await this.clearAuth();
    // Optionally clear trusted device on logout (uncomment to require OTP after logout)
    // await deviceManager.clearTrustedDevice();
  }

  /**
   * Get user profile
   */
  async getProfile() {
    return this.request('/auth/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    const data = await this.request('/auth/me', {
      method: 'PATCH',
      body: updates,
    });
    
    if (data.user) {
      await this.saveUser(data.user);
    }
    
    return data;
  }

  // ============ Device Endpoints ============

  /**
   * Get all user devices
   */
  async getDevices() {
    return this.request('/devices');
  }

  /**
   * Register a new device
   */
  async registerDevice(deviceId, name, wifi, mqttSecret) {
    return this.request('/devices', {
      method: 'POST',
      body: { deviceId, name, wifi, mqttSecret },
    });
  }

  /**
   * Get single device
   */
  async getDevice(deviceId) {
    return this.request(`/devices/${deviceId}`);
  }

  /**
   * Update device
   */
  async updateDevice(deviceId, updates) {
    return this.request(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  /**
   * Delete device
   */
  async deleteDevice(deviceId) {
    return this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export default new ApiService();
