import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BleConnectionManager } from '../utils/bleConnectionManager';
import { Buffer } from 'buffer';
import api from '../services/api';

// BLE Service and Characteristic UUIDs (aligned with ESP32 NimBLE firmware)
// Service UUID for Nordic UART Service (NUS)
const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const RX_CHAR_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // Write to this (App → Lamp)
const TX_CHAR_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // Subscribe to this (Lamp → App)

// Provisioning timeout (60 seconds)
const PROVISIONING_TIMEOUT = 60000;

const ProvisioningScreen = ({ route, navigation }) => {
  const { deviceId, deviceName } = route.params;
  
  // Get device from connection manager (non-serializable objects stored here)
  // Store in ref to prevent null on re-renders after clearing
  const deviceRef = useRef(BleConnectionManager.getConnectedDevice());
  const device = deviceRef.current;

  // Form state
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState(null); // 'sending' | 'connecting' | 'success' | 'failed'
  const [provisioningError, setProvisioningError] = useState(null);

  const provisioningTimeoutRef = useRef(null);
  const statusSubscriptionRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasNavigatedAwayRef = useRef(false);

  // Safe setState wrapper to prevent updates after unmount
  const safeSetState = (setter, value) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };

  /**
   * Clean up provisioning resources
   * NOTE: We intentionally DON'T call subscription.remove() here because
   * it can crash the native BLE module (NullPointerException in cancelTransaction)
   */
  const cleanupProvisioning = () => {
    try {
      // Clear timeout
      if (provisioningTimeoutRef.current) {
        clearTimeout(provisioningTimeoutRef.current);
        provisioningTimeoutRef.current = null;
      }

      // Just nullify the ref - DON'T call .remove() on the subscription
      // The subscription will clean up when BLE connection is closed
      statusSubscriptionRef.current = null;

      // Clear sensitive data only if mounted
      if (isMountedRef.current) {
        setPassword('');
      }
    } catch (cleanupError) {
      console.log('Error during cleanup:', cleanupError.message);
    }
  };

  /**
   * Encode Wi-Fi credentials to send to device
   * JSON → Base64 (BLE library decodes base64 and sends raw JSON bytes to device)
   */
  const encodeCredentials = (wifiSsid, wifiPassword) => {
    const payload = JSON.stringify({
      ssid: wifiSsid,
      password: wifiPassword,
    });
    // Encode to base64 - BLE library expects base64 input and decodes it before sending
    return Buffer.from(payload).toString('base64');
  };

  /**
   * Decode provisioning status from device response
   * BLE layer delivers base64, ESP32 sends plain JSON
   */
  const decodeStatus = (base64Value) => {
    try {
      console.log('Decoding notification value:', base64Value);
      // Decode base64 from BLE transport layer
      const response = Buffer.from(base64Value, 'base64').toString('utf-8');
      console.log('Decoded response (UTF-8):', response);
      const parsed = JSON.parse(response);
      console.log('Parsed JSON:', parsed);
      return parsed;
    } catch (error) {
      console.log('Error decoding status:', error.message);
      console.log('Raw value was:', base64Value);
      return null;
    }
  };

  // Error code to message mapping for compact ESP32 responses
  const ERROR_MESSAGES = {
    1: 'Empty data received',
    2: 'Data encoding error',
    3: 'Invalid data format',
    4: 'Wi-Fi network name missing',
    5: 'Wi-Fi network name too long',
    6: 'Wi-Fi password too long',
    7: 'Failed to save credentials',
    8: 'Wi-Fi connection failed - please check your password',
  };

  /**
   * Handle provisioning status updates from device
   * ESP32 firmware sends compact format: { ok: 1 } or { ok: 0, e: <code> }
   */
  const handleStatusUpdate = (status) => {
    console.log('Provisioning status update:', status);
    if (!isMountedRef.current) return;

    // Handle new compact format: {ok: 1} for success, {ok: 0, e: X} for failure
    if (status.ok === 1) {
      console.log('Provisioning successful');
      
      // DON'T call cleanupProvisioning() here - it removes the subscription
      // while we're still inside the notification callback, causing a crash.
      // Just clear the timeout, subscription will be cleaned up on unmount.
      if (provisioningTimeoutRef.current) {
        clearTimeout(provisioningTimeoutRef.current);
        provisioningTimeoutRef.current = null;
      }
      
      safeSetState(setProvisioningStatus, 'success');
      safeSetState(setIsProvisioning, false);

      // Capture current values to avoid closure issues
      const currentSsid = ssid.trim();
      const currentDeviceId = deviceId;
      const currentDeviceName = deviceName;

      // Register device with backend and navigate
      setTimeout(async () => {
        try {
          if (hasNavigatedAwayRef.current) {
            console.log('Already navigated away, skipping');
            return;
          }
          
          hasNavigatedAwayRef.current = true; // Mark that we're navigating
          console.log('Registering device with backend...');
          
          // Register device with backend
          try {
            const wifiInfo = {
              ssid: currentSsid,
              provisionedAt: new Date().toISOString(),
            };
            const response = await api.registerDevice(currentDeviceId, currentDeviceName, wifiInfo);
            console.log('Device registered:', response);
          } catch (regError) {
            console.log('Device registration error (non-blocking):', regError.message);
            // Continue navigation even if registration fails - user can retry later
          }
          
          // Clear device reference - connection will be cleaned up
          try {
            BleConnectionManager.clearConnectedDevice();
          } catch (clearError) {
            console.log('Clear device error (non-blocking):', clearError.message);
          }
          
          // Navigate to Home instead of DeviceStatus to avoid MQTT issues
          console.log('Navigating to Home...');
          navigation.replace('Home');
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fallback navigation
          try {
            navigation.navigate('Home');
          } catch (e) {
            console.error('Fallback navigation also failed:', e);
          }
        }
      }, 2000);
    } else if (status.ok === 0) {
      const errorMsg = ERROR_MESSAGES[status.e] || 'Provisioning failed';
      console.log('Provisioning failed, error code:', status.e, '-', errorMsg);
      // Defer cleanup to avoid crash in notification callback
      if (provisioningTimeoutRef.current) {
        clearTimeout(provisioningTimeoutRef.current);
        provisioningTimeoutRef.current = null;
      }
      safeSetState(setIsProvisioning, false);
      safeSetState(setProvisioningError, errorMsg);
    } else if (status.status === 'SUCCESS') {
      // Legacy format support
      console.log('Provisioning successful (legacy format)');
      // Defer cleanup to avoid crash in notification callback
      if (provisioningTimeoutRef.current) {
        clearTimeout(provisioningTimeoutRef.current);
        provisioningTimeoutRef.current = null;
      }
      safeSetState(setProvisioningStatus, 'success');
      safeSetState(setIsProvisioning, false);
      
      // Capture current values to avoid closure issues
      const currentSsid = ssid.trim();
      const currentDeviceId = deviceId;
      const currentDeviceName = deviceName;
      
      setTimeout(async () => {
        try {
          if (hasNavigatedAwayRef.current) return;
          hasNavigatedAwayRef.current = true;
          
          // Register device with backend
          try {
            const wifiInfo = {
              ssid: currentSsid,
              provisionedAt: new Date().toISOString(),
            };
            await api.registerDevice(currentDeviceId, currentDeviceName, wifiInfo);
            console.log('Device registered (legacy)');
          } catch (regError) {
            console.log('Device registration error (non-blocking):', regError.message);
          }
          
          try {
            BleConnectionManager.clearConnectedDevice();
          } catch (clearError) {
            console.log('Clear device error:', clearError.message);
          }
          
          navigation.replace('Home');
        } catch (navError) {
          console.error('Navigation error (legacy):', navError);
          try {
            navigation.navigate('Home');
          } catch (e) {
            console.error('Fallback navigation failed:', e);
          }
        }
      }, 2000);
    } else if (status.status === 'FAIL') {
      // Legacy format support
      console.log('Provisioning failed (legacy format):', status.reason);
      // Defer cleanup to avoid crash in notification callback
      if (provisioningTimeoutRef.current) {
        clearTimeout(provisioningTimeoutRef.current);
        provisioningTimeoutRef.current = null;
      }
      safeSetState(setIsProvisioning, false);
      safeSetState(setProvisioningError, status.reason || 'Failed to connect device to Wi-Fi');
    } else {
      console.log('Unknown status format:', status);
    }
  };

  /**
   * Start BLE provisioning
   */
  const startProvisioning = async () => {
    // Validate SSID (required, 1-32 chars per ESP32 spec)
    const trimmedSsid = ssid.trim();
    if (!trimmedSsid) {
      setProvisioningError('Please enter Wi-Fi network name');
      return;
    }
    if (trimmedSsid.length > 32) {
      setProvisioningError('Wi-Fi network name must be 32 characters or less');
      return;
    }

    // Validate password (optional for open networks, max 64 chars per ESP32 spec)
    if (password.length > 64) {
      setProvisioningError('Wi-Fi password must be 64 characters or less');
      return;
    }

    // Verify device is still available
    if (!device) {
      setProvisioningError('Device connection lost. Please go back and reconnect.');
      return;
    }

    console.log('Starting provisioning for SSID:', trimmedSsid);
    setIsProvisioning(true);
    setProvisioningStatus('sending');
    setProvisioningError(null);

    // Set provisioning timeout
    provisioningTimeoutRef.current = setTimeout(() => {
      console.log('Provisioning timeout');
      if (!isMountedRef.current) return;
      cleanupProvisioning();
      safeSetState(setIsProvisioning, false);
      safeSetState(setProvisioningError, 'Provisioning timeout. Please check your Wi-Fi credentials and try again.');
    }, PROVISIONING_TIMEOUT);

    try {
      // Step 1: Verify device is still connected, reconnect if needed
      console.log('=== PROVISIONING STARTED ===');
      console.log('Verifying device connection...');
      let isConnected = await device.isConnected();
      
      if (!isConnected) {
        console.log('Device disconnected, attempting to reconnect...');
        try {
          await device.connect({ requestMTU: 512 });
          console.log('Reconnected, requesting MTU...');
          try {
            await device.requestMTU(512);
          } catch (mtuErr) {
            console.log('MTU request failed:', mtuErr.message);
          }
          console.log('Rediscovering services...');
          await device.discoverAllServicesAndCharacteristics();
          isConnected = await device.isConnected();
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError.message);
          throw new Error('Device disconnected and could not reconnect. Please go back and try again.');
        }
      }
      
      if (!isConnected) {
        throw new Error('Device is not connected');
      }
      console.log('Device is connected');

      // Step 2: Verify service exists by getting services
      console.log('Verifying BLE services...');
      console.log('Looking for SERVICE_UUID:', SERVICE_UUID);
      const services = await device.services();
      console.log('Found', services.length, 'services:');
      services.forEach((s, i) => console.log(`  [${i}] ${s.uuid}`));
      
      const provisioningService = services.find(
        s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()
      );
      
      if (!provisioningService) {
        console.error('=== SERVICE NOT FOUND ===');
        console.error('Expected:', SERVICE_UUID.toLowerCase());
        console.error('Available:', services.map(s => s.uuid.toLowerCase()));
        throw new Error('Provisioning service not found on device. Please ensure device firmware is up to date.');
      }
      console.log('Found provisioning service:', provisioningService.uuid);

      // Step 3: Verify characteristics exist
      console.log('Looking for characteristics...');
      console.log('  RX_CHAR_UUID:', RX_CHAR_UUID);
      console.log('  TX_CHAR_UUID:', TX_CHAR_UUID);
      const characteristics = await provisioningService.characteristics();
      console.log('Found', characteristics.length, 'characteristics:');
      characteristics.forEach((c, i) => {
        console.log(`  [${i}] ${c.uuid} - isNotifiable: ${c.isNotifiable}, isWritableWithResponse: ${c.isWritableWithResponse}`);
      });
      
      const rxChar = characteristics.find(
        c => c.uuid.toLowerCase() === RX_CHAR_UUID.toLowerCase()
      );
      const txChar = characteristics.find(
        c => c.uuid.toLowerCase() === TX_CHAR_UUID.toLowerCase()
      );

      if (!rxChar || !txChar) {
        console.error('=== CHARACTERISTICS NOT FOUND ===');
        console.error('RX found:', !!rxChar, rxChar?.uuid);
        console.error('TX found:', !!txChar, txChar?.uuid);
        throw new Error('Device does not support provisioning. Please update firmware.');
      }
      console.log('Found RX characteristic:', rxChar.uuid);
      console.log('Found TX characteristic:', txChar.uuid, '- isNotifiable:', txChar.isNotifiable);

      // Step 4: Subscribe to status notifications BEFORE writing credentials
      console.log('Subscribing to TX characteristic for notifications...');
      statusSubscriptionRef.current = device.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_CHAR_UUID,
        (error, characteristic) => {
          try {
            console.log('=== NOTIFICATION CALLBACK ===');
            if (!isMountedRef.current || hasNavigatedAwayRef.current) {
              console.log('Component unmounted or navigated away, ignoring notification');
              return;
            }
            
            if (error) {
              console.error('Status monitor error:', error.message);
              if (isMountedRef.current && !hasNavigatedAwayRef.current) {
                cleanupProvisioning();
                safeSetState(setIsProvisioning, false);
                safeSetState(setProvisioningError, 'Lost connection to device');
              }
              return;
            }

            console.log('Notification received, characteristic value:', characteristic?.value);
            if (characteristic?.value) {
              const status = decodeStatus(characteristic.value);
              console.log('Decoded status:', status);
              if (status) {
                handleStatusUpdate(status);
              } else {
                console.log('Failed to decode status from notification');
              }
            } else {
              console.log('No value in notification');
            }
          } catch (callbackError) {
            console.error('Error in notification callback:', callbackError.message);
          }
        }
      );
      console.log('Subscription created successfully');

      // Small delay to ensure subscription is active
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 5: Encode and send credentials
      const base64Payload = encodeCredentials(trimmedSsid, password);
      console.log('Encoded payload (base64):', base64Payload);
      console.log('Writing Wi-Fi credentials to device via RX characteristic...');

      // Write credentials to RX characteristic
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        RX_CHAR_UUID,
        base64Payload
      );

      console.log('=== WRITE SUCCESSFUL ===');
      console.log('Credentials sent to device, now waiting for notification response...');
      console.log('If no response within 60s, check ESP32 serial monitor for logs');
      safeSetState(setProvisioningStatus, 'connecting');

    } catch (error) {
      console.error('Provisioning error:', error.message, error);
      if (!isMountedRef.current) return;
      
      cleanupProvisioning();
      safeSetState(setIsProvisioning, false);

      // Set user-friendly error message based on error type
      let errorMessage = error.message || 'Failed to send Wi-Fi credentials';
      
      if (error.message?.includes('not connected')) {
        errorMessage = 'Device disconnected. Please go back, reconnect, and try again.';
      } else if (error.message?.includes('service not found') || error.message?.includes('Provisioning service')) {
        errorMessage = 'This device does not support Wi-Fi provisioning. Please ensure you are connecting to the correct device.';
      } else if (error.message?.includes('firmware')) {
        errorMessage = error.message;
      } else if (error.message?.includes('disconnected')) {
        errorMessage = 'Device disconnected. Please reconnect and try again.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Device does not support provisioning. Please update device firmware.';
      } else if (error.message?.includes('write')) {
        errorMessage = 'Failed to send data to device. Please try again.';
      }

      safeSetState(setProvisioningError, errorMessage);
    }
  };

  /**
   * Retry provisioning
   */
  const handleRetry = () => {
    setProvisioningError(null);
    setProvisioningStatus(null);
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    hasNavigatedAwayRef.current = false;
    return () => {
      isMountedRef.current = false;
      try {
        // Clear timeout only - DON'T remove the BLE subscription here
        // Removing the subscription while navigating away causes a native crash
        // in react-native-ble-plx (NullPointerException in cancelTransaction)
        if (provisioningTimeoutRef.current) {
          clearTimeout(provisioningTimeoutRef.current);
          provisioningTimeoutRef.current = null;
        }
        // DON'T call statusSubscriptionRef.current.remove() - it crashes!
        // The subscription will be cleaned up when BLE connection closes
        statusSubscriptionRef.current = null;
        
        // Only clear device if we haven't already navigated away successfully
        if (!hasNavigatedAwayRef.current) {
          BleConnectionManager.clearConnectedDevice();
        }
      } catch (error) {
        console.log('Error during cleanup:', error.message);
      }
    };
  }, []);

  // Error boundary: if device not found, show error
  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Device Connection Lost</Text>
        <Text style={styles.errorText}>
          Unable to access device: {deviceName || deviceId}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // SUCCESS UI
  if (provisioningStatus === 'success') {
    return (
      <View style={styles.container}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Device Connected!</Text>
        <Text style={styles.successText}>
          Your Smart Lamp is now connected to Wi-Fi.
        </Text>
      </View>
    );
  }

  // PROVISIONING IN PROGRESS UI
  if (isProvisioning) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.provisioningTitle}>
          {provisioningStatus === 'sending'
            ? 'Sending Wi-Fi details…'
            : 'Connecting device to Wi-Fi…'}
        </Text>
        <Text style={styles.provisioningHint}>
          This may take up to a minute. Please keep the device powered on.
        </Text>
      </View>
    );
  }

  // ERROR UI
  if (provisioningError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Provisioning Failed</Text>
        <Text style={styles.errorText}>{provisioningError}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRetry}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // FORM UI
  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Connect to Wi-Fi</Text>
        <Text style={styles.subtitle}>
          Enter your Wi-Fi network details to connect your {device.name || 'device'}.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Wi-Fi Network Name (SSID)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter network name"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Wi-Fi Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? '🙈' : '👁️'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, (!ssid || !password) && styles.buttonDisabled]}
            onPress={startProvisioning}
            disabled={!ssid || !password}
          >
            <Text style={styles.buttonText}>Provision Device</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.securityNote}>
          🔒 Your Wi-Fi credentials are sent securely via Bluetooth and are not stored by the app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  showPasswordText: {
    fontSize: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#666',
    marginTop: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#000',
  },
  securityNote: {
    fontSize: 14,
    color: '#999',
    marginTop: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  provisioningTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  provisioningHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#4caf50',
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#d32f2f',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
});

export default ProvisioningScreen;
