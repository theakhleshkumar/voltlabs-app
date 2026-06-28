import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  AppState,
  Alert,
  NativeModules,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { BleConnectionManager } from '../utils/bleConnectionManager';
import { checkBlePermissions, requestBlePermissions } from '../utils/blePermissions';
import { fonts } from '../constants/theme';

const { BluetoothModule } = NativeModules;


const SCAN_DURATION = 10000; // 10 seconds

const BleScanScreen = ({ navigation }) => {
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [bluetoothState, setBluetoothState] = useState('Unknown');
  const [isEnablingBluetooth, setIsEnablingBluetooth] = useState(false);
  
  // Connection state
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const connectionTimeoutRef = useRef(null);
  const enablingTimeoutRef = useRef(null);
  
  // Separate refs for state-detection BleManager and real operations BleManager
  const stateDetectionManagerRef = useRef(null);
  const bleManagerRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const stateSubscriptionRef = useRef(null);

  // Stop scanning safely
  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    if (bleManagerRef.current) {
      try {
        bleManagerRef.current.stopDeviceScan();
      } catch (error) {
        console.log('Error stopping scan:', error);
      }
    }

    setIsScanning(false);
    setScanComplete(true);
  }, []);

  // Start BLE scanning (ONLY when Bluetooth is PoweredOn)
  const startScan = useCallback(() => {
    if (isScanning) return;
    if (!bleManagerRef.current) return;
    if (bluetoothState !== 'PoweredOn') return;

    setDevices([]);
    setIsScanning(true);
    setScanComplete(false);

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
    }, SCAN_DURATION);

    bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        stopScan();
        return;
      }

      if (device && device.name && device.name.startsWith('VoltLabs_Lamp_')) {
        setDevices(prevDevices => {
          const exists = prevDevices.some(d => d.id === device.id);
          if (!exists) {
            return [...prevDevices, { id: device.id, name: device.name }];
          }
          return prevDevices;
        });
      }
    });
  }, [stopScan, bluetoothState, isScanning]);

  // Initialize real BleManager for operations when Bluetooth is ON
  const initializeBluetoothOperations = useCallback(() => {
    if (bleManagerRef.current) return; // Already initialized

    console.log('Initializing BLE operations manager');
    bleManagerRef.current = new BleManager();
    
    // Store in connection manager for access across screens
    BleConnectionManager.setBleManager(bleManagerRef.current);
    
    // Start scanning immediately after initialization
    setTimeout(() => {
      startScan();
    }, 100);
  }, [startScan]);

  // Clean up real BleManager when Bluetooth goes OFF
  const cleanupBluetoothOperations = useCallback(() => {
    stopScan();

    if (bleManagerRef.current) {
      console.log('Cleaning up BLE operations manager');
      try {
        bleManagerRef.current.destroy();
      } catch (error) {
        console.log('Error destroying BLE manager:', error);
      }
      bleManagerRef.current = null;
      // Clear connection manager references
      BleConnectionManager.clearAll();
    }

    setDevices([]);
    setScanComplete(false);
  }, [stopScan]);

  // Main effect: Handle Bluetooth state detection and lifecycle
  useEffect(() => {
    console.log('BleScanScreen mounted - creating state detection manager');
    
    // Create TEMPORARY BleManager ONLY for state detection
    stateDetectionManagerRef.current = new BleManager();

    // Subscribe to Bluetooth state changes
    stateSubscriptionRef.current = stateDetectionManagerRef.current.onStateChange(
      state => {
        console.log('=== BLUETOOTH STATE CHANGE ===');
        console.log('New state:', state);
        console.log('Previous state:', bluetoothState);
        setBluetoothState(state);
      },
      true // Emit current state immediately
    );

    // Listen for app becoming active (user returns from settings)
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && stateDetectionManagerRef.current) {
        stateDetectionManagerRef.current.state().then(state => {
          console.log('App active - Bluetooth state:', state);
          setBluetoothState(state);
        }).catch(() => {
          // Ignore errors
        });
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('BleScanScreen unmounting - cleaning up');
      
      // Clear enabling timeout
      if (enablingTimeoutRef.current) {
        clearTimeout(enablingTimeoutRef.current);
        enablingTimeoutRef.current = null;
      }
      
      // Clean up operations manager
      cleanupBluetoothOperations();

      // Clean up app state listener
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
      
      // Clean up state subscription
      if (stateSubscriptionRef.current) {
        stateSubscriptionRef.current.remove();
        stateSubscriptionRef.current = null;
      }
      
      // Clean up state detection manager
      if (stateDetectionManagerRef.current) {
        try {
          stateDetectionManagerRef.current.destroy();
        } catch (error) {
          console.log('Error destroying state detection manager:', error);
        }
        stateDetectionManagerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupBluetoothOperations]);

  // Effect: React to Bluetooth state changes
  useEffect(() => {
    if (bluetoothState === 'PoweredOn') {
      // Bluetooth is ON - initialize operations manager and start scanning
      // Clear enabling timeout and state
      if (enablingTimeoutRef.current) {
        clearTimeout(enablingTimeoutRef.current);
        enablingTimeoutRef.current = null;
      }
      setIsEnablingBluetooth(false);
      initializeBluetoothOperations();
    } else if (bluetoothState !== 'Unknown') {
      // Bluetooth is OFF or other state - clean up operations manager
      // Also clear enabling state in case it's stuck
      if (enablingTimeoutRef.current) {
        clearTimeout(enablingTimeoutRef.current);
        enablingTimeoutRef.current = null;
      }
      setIsEnablingBluetooth(false);
      cleanupBluetoothOperations();
    }
  }, [bluetoothState, initializeBluetoothOperations, cleanupBluetoothOperations]);

  const handleRetryScan = () => {
    if (bluetoothState === 'PoweredOn') {
      startScan();
    }
  };

  /**
   * Handle Enable Bluetooth button press
   * Uses native Android Intent to show system dialog
   */
  const handleEnableBluetooth = async () => {
    console.log('=== ENABLE BLUETOOTH STARTED ===');
    
    // Step 1: Check if we have the required permissions
    let hasPermissions = await checkBlePermissions();
    console.log('BLE permissions granted:', hasPermissions);
    
    // Step 2: If no permissions, request them now
    if (!hasPermissions) {
      console.log('Requesting BLE permissions...');
      const permissionResult = await requestBlePermissions();
      console.log('Permission request result:', permissionResult);
      
      if (permissionResult !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required. Please grant all requested permissions.',
          [{ text: 'OK' }]
        );
        return;
      }
      hasPermissions = true;
    }

    console.log('Permissions OK, enabling Bluetooth via native module');
    setIsEnablingBluetooth(true);

    try {
      // Use native BluetoothModule to show system enable dialog
      if (!BluetoothModule) {
        throw new Error('BluetoothModule not available - rebuild app required');
      }
      
      console.log('Calling BluetoothModule.requestEnable()...');
      const result = await BluetoothModule.requestEnable();
      console.log('BluetoothModule.requestEnable() result:', result);
      
      // Clear enabling state
      setIsEnablingBluetooth(false);
      
      if (result === true) {
        console.log('Bluetooth enabled successfully!');
        // State will be updated by onStateChange listener
      } else {
        console.log('User denied Bluetooth enable request');
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please tap ENABLE and accept the dialog to turn on Bluetooth.',
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('Bluetooth enable error:', error);
      setIsEnablingBluetooth(false);
      
      Alert.alert(
        'Cannot Enable Bluetooth',
        error.message || 'Unknown error occurred',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Connect to selected BLE device
   */
  const connectToDevice = useCallback(async (device) => {
    if (!bleManagerRef.current) {
      console.log('BLE manager not available');
      return;
    }

    console.log('Connecting to device:', device.name, device.id);
    setIsConnecting(true);
    setConnectionError(null);

    // Set connection timeout (15 seconds)
    connectionTimeoutRef.current = setTimeout(() => {
      console.log('Connection timeout');
      setIsConnecting(false);
      setConnectionError('Connection timeout. Please try again.');
      
      // Cancel connection attempt
      if (bleManagerRef.current) {
        bleManagerRef.current.cancelDeviceConnection(device.id)
          .catch(error => console.log('Error canceling connection:', error.message));
      }
    }, 15000);

    try {
      // Connect to device
      console.log('Attempting to connect...');
      const connectedDevice = await bleManagerRef.current.connectToDevice(device.id, {
        autoConnect: false,
        requestMTU: 512, // Request larger MTU for longer messages
      });

      console.log('Connected successfully, requesting MTU...');
      
      // Request larger MTU to handle longer JSON responses
      try {
        const mtu = await connectedDevice.requestMTU(512);
        console.log('MTU negotiated:', mtu);
      } catch (mtuError) {
        console.log('MTU request failed (using default):', mtuError.message);
      }
      
      console.log('Discovering services...');
      
      // Discover services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      console.log('Services discovered successfully');

      // Clear timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      setIsConnecting(false);
      
      // Store connected device in connection manager
      BleConnectionManager.setConnectedDevice(connectedDevice);
      
      // Navigate to provisioning screen with only serializable data
      navigation.navigate('Provisioning', {
        deviceId: connectedDevice.id,
        deviceName: connectedDevice.name || 'Unknown Device',
      });
      
    } catch (error) {
      console.error('Connection error:', error.message);
      
      // Clear timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      setIsConnecting(false);
      
      // Set user-friendly error message
      let errorMessage = 'Failed to connect to device.';
      if (error.message.includes('timeout')) {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.message.includes('disconnected')) {
        errorMessage = 'Device disconnected. Please try again.';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Device not found. Please scan again.';
      }
      
      setConnectionError(errorMessage);
    }
  }, [navigation]);

  /**
   * Handle device selection from list
   */
  const handleDevicePress = (device) => {
    if (isConnecting) {
      console.log('Connection already in progress');
      return;
    }

    console.log('Device selected:', device.name);
    
    // Stop scanning first
    stopScan();
    
    // Set selected device and start connection
    setSelectedDevice(device);
    
    // Start connection after brief delay
    setTimeout(() => {
      connectToDevice(device);
    }, 100);
  };

  /**
   * Handle retry connection
   */
  const handleRetryConnection = () => {
    if (selectedDevice) {
      setConnectionError(null);
      connectToDevice(selectedDevice);
    }
  };

  /**
   * Cancel connection and return to scan list
   */
  const handleCancelConnection = () => {
    console.log('Canceling connection');
    
    // Clear timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // Cancel device connection if in progress
    if (selectedDevice && bleManagerRef.current) {
      bleManagerRef.current.cancelDeviceConnection(selectedDevice.id)
        .catch(error => console.log('Error canceling connection:', error.message));
    }

    setSelectedDevice(null);
    setIsConnecting(false);
    setConnectionError(null);
    
    // Restart scan
    if (bluetoothState === 'PoweredOn') {
      setTimeout(() => {
        startScan();
      }, 200);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity 
      style={styles.deviceItem}
      onPress={() => handleDevicePress(item)}
      disabled={isConnecting}
    >
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </TouchableOpacity>
  );

  // ENABLING BLUETOOTH UI: Show while Bluetooth is being enabled
  if (isEnablingBluetooth) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.enablingTitle}>Enabling Bluetooth adapter...</Text>
        <Text style={styles.enablingSubtitle}>Turning on Bluetooth...</Text>
        <TouchableOpacity 
          style={[styles.retryButton, styles.secondaryButton, styles.enablingCancelButton]}
          onPress={() => {
            if (enablingTimeoutRef.current) {
              clearTimeout(enablingTimeoutRef.current);
              enablingTimeoutRef.current = null;
            }
            setIsEnablingBluetooth(false);
          }}
        >
          <Text style={[styles.retryButtonText, styles.secondaryButtonText]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // BLUETOOTH OFF UI: Show enable button when Bluetooth is OFF
  if (bluetoothState !== 'PoweredOn' && bluetoothState !== 'Unknown') {
    return (
      <View style={styles.container}>
        <Text style={styles.bluetoothOffIcon}>📶</Text>
        <Text style={styles.bluetoothOffTitle}>Bluetooth adapter is disabled</Text>
        <Text style={styles.bluetoothOffDescription}>
          Bluetooth must be enabled to find your VoltLabs device.
        </Text>
        <TouchableOpacity 
          style={styles.enableButton}
          onPress={handleEnableBluetooth}
        >
          <Text style={styles.enableButtonText}>ENABLE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // CONNECTING UI: Show while connecting to device
  if (isConnecting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.scanningText}>
          Connecting to {selectedDevice?.name || 'device'}…
        </Text>
        <Text style={styles.hintText}>
          This may take a few seconds.
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, styles.cancelButton]} 
          onPress={handleCancelConnection}
        >
          <Text style={styles.retryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // CONNECTION ERROR UI: Show when connection fails
  if (connectionError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorText}>{connectionError}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetryConnection}
        >
          <Text style={styles.retryButtonText}>Retry Connection</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, styles.secondaryButton]} 
          onPress={handleCancelConnection}
        >
          <Text style={[styles.retryButtonText, styles.secondaryButtonText]}>Back to Scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // SCANNING UI: Show loading state
  if (isScanning) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.scanningText}>Searching for nearby devices…</Text>
        <Text style={styles.hintText}>
          Make sure your Smart Lamp is powered on.
        </Text>
      </View>
    );
  }

  // EMPTY STATE: No devices found
  if (scanComplete && devices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No devices found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetryScan}>
          <Text style={styles.retryButtonText}>Retry scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // RESULTS UI: Show found devices
  return (
    <View style={styles.containerWithList}>
      <Text style={styles.title}>Available devices</Text>
      <FlatList
        data={devices}
        renderItem={renderDevice}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity style={styles.retryButton} onPress={handleRetryScan}>
        <Text style={styles.retryButtonText}>Scan again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  containerWithList: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  bluetoothOffIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  bluetoothOffTitle: {
    fontFamily: fonts.medium,
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
    color: '#444',
  },
  bluetoothOffDescription: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  enableButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  enableButtonText: {
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  enablingTitle: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  enablingSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  bluetoothHint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  scanningText: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  deviceItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  deviceName: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    marginBottom: 4,
  },
  deviceId: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#666',
  },
  retryButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  retryButtonText: {
    fontFamily: fonts.semiBold,
    color: '#fff',
    fontSize: 16,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center',
    color: '#d32f2f',
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  cancelButton: {
    backgroundColor: '#666',
    marginTop: 32,
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
  enablingCancelButton: {
    marginTop: 32,
  },
});

export default BleScanScreen;





