/**
 * Device Status Context
 * Global state management for real-time device status via MQTT
 * Maintains subscriptions and status across all screens
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import mqttClient from '../utils/mqttClient';

const DeviceStatusContext = createContext(null);

export const DeviceStatusProvider = ({ children }) => {
  const [deviceStatuses, setDeviceStatuses] = useState({}); // { deviceName: { online, brightness, r, g, b } }
  const [mqttConnected, setMqttConnected] = useState(false);
  const subscribedDevicesRef = useRef(new Set());
  const statusDebounceTimers = useRef({});
  const isMountedRef = useRef(true);

  // Debounced status update to prevent false→true flickering from retained LWT messages
  const updateDeviceStatus = useCallback((deviceName, status) => {
    // status is always an object with { online, power, brightness, r, g, b }
    const isOnline = status?.online;
    
    // Clear any pending update for this device
    if (statusDebounceTimers.current[deviceName]) {
      clearTimeout(statusDebounceTimers.current[deviceName]);
      statusDebounceTimers.current[deviceName] = null;
    }
    
    // If going online, update immediately
    if (isOnline) {
      setDeviceStatuses(prev => ({
        ...prev,
        [deviceName]: status,
      }));
      return;
    }
    
    // If going offline, debounce by 2 seconds to allow online message to arrive
    statusDebounceTimers.current[deviceName] = setTimeout(() => {
      if (isMountedRef.current) {
        setDeviceStatuses(prev => ({
          ...prev,
          [deviceName]: status,
        }));
      }
    }, 2000);
  }, []);

  // Connect to MQTT broker
  const connectMqtt = useCallback(async () => {
    if (mqttClient.getConnectionStatus()) {
      setMqttConnected(true);
      return true;
    }

    try {
      console.log('[DeviceStatusContext] Connecting to MQTT...');
      await mqttClient.connect();
      setMqttConnected(true);
      return true;
    } catch (error) {
      console.error('[DeviceStatusContext] MQTT connection error:', error);
      setMqttConnected(false);
      return false;
    }
  }, []);

  // Subscribe to a device's status
  const subscribeToDevice = useCallback(async (deviceName) => {
    if (subscribedDevicesRef.current.has(deviceName)) {
      console.log(`[DeviceStatusContext] Already subscribed to ${deviceName}`);
      return;
    }

    // Ensure MQTT is connected
    const connected = await connectMqtt();
    if (!connected) {
      console.error('[DeviceStatusContext] Cannot subscribe - MQTT not connected');
      return;
    }

    try {
      console.log(`[DeviceStatusContext] Subscribing to ${deviceName}`);
      await mqttClient.subscribeToDevice(deviceName, (status) => {
        if (isMountedRef.current) {
          console.log(`[DeviceStatusContext] Status update for ${deviceName}:`, status);
          updateDeviceStatus(deviceName, status);
        }
      });
      subscribedDevicesRef.current.add(deviceName);
    } catch (error) {
      console.error(`[DeviceStatusContext] Subscribe error for ${deviceName}:`, error);
    }
  }, [connectMqtt, updateDeviceStatus]);

  // Subscribe to multiple devices
  const subscribeToDevices = useCallback(async (devices) => {
    if (!devices || devices.length === 0) return;

    for (const device of devices) {
      await subscribeToDevice(device.name);
    }
  }, [subscribeToDevice]);

  // Unsubscribe from a device
  const unsubscribeFromDevice = useCallback((deviceName) => {
    if (!subscribedDevicesRef.current.has(deviceName)) return;

    try {
      console.log(`[DeviceStatusContext] Unsubscribing from ${deviceName}`);
      mqttClient.unsubscribeFromDevice(deviceName);
      subscribedDevicesRef.current.delete(deviceName);
      
      // Clear debounce timer
      if (statusDebounceTimers.current[deviceName]) {
        clearTimeout(statusDebounceTimers.current[deviceName]);
        delete statusDebounceTimers.current[deviceName];
      }
    } catch (error) {
      // Ignore unsubscribe errors
    }
  }, []);

  // Get status for a specific device
  const getDeviceStatus = useCallback((deviceName) => {
    return deviceStatuses[deviceName];
  }, [deviceStatuses]);

  // Check if we have status for a device
  const hasDeviceStatus = useCallback((deviceName) => {
    return deviceStatuses.hasOwnProperty(deviceName);
  }, [deviceStatuses]);

  // Send command to a device
  const sendCommand = useCallback(async (deviceName, command) => {
    // Ensure MQTT is connected
    const connected = await connectMqtt();
    if (!connected) {
      throw new Error('MQTT not connected');
    }

    try {
      await mqttClient.publishCommand(deviceName, command);
      console.log(`[DeviceStatusContext] Command sent to ${deviceName}:`, command);
    } catch (error) {
      console.error(`[DeviceStatusContext] Failed to send command:`, error);
      throw error;
    }
  }, [connectMqtt]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Clear all debounce timers
      Object.values(statusDebounceTimers.current).forEach(t => {
        if (t) clearTimeout(t);
      });
      statusDebounceTimers.current = {};
    };
  }, []);

  const value = {
    deviceStatuses,
    mqttConnected,
    subscribeToDevice,
    subscribeToDevices,
    unsubscribeFromDevice,
    getDeviceStatus,
    hasDeviceStatus,
    connectMqtt,
    sendCommand,
  };

  return (
    <DeviceStatusContext.Provider value={value}>
      {children}
    </DeviceStatusContext.Provider>
  );
};

// Hook to use the device status context
export const useDeviceStatus = () => {
  const context = useContext(DeviceStatusContext);
  if (!context) {
    throw new Error('useDeviceStatus must be used within a DeviceStatusProvider');
  }
  return context;
};

export default DeviceStatusContext;
