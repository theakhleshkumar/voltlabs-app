/**
 * useDeviceStatus hook
 * Subscribe to device online/offline status via global MQTT context
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceStatus as useDeviceStatusContext } from '../context/DeviceStatusContext';

/**
 * Hook to get real-time device status
 * @param {string} deviceName - Device name (e.g., "VoltLabs_Lamp_ABCD")
 * @returns {{
 *   isOnline: boolean | null,
 *   power: boolean | null,
 *   brightness: number | null,
 *   r: number | null,
 *   g: number | null,
 *   b: number | null,
 *   isConnecting: boolean,
 *   error: string | null,
 *   lastSeen: Date | null,
 *   wakeUp: {enabled, hour, minute, duration} | null,
 *   schedules: Array<{id, hour, minute, action, enabled}> | null,
 *   sleepTimer: {active, remaining} | null,
 *   reconnect: () => void
 * }}
 */
export function useDeviceStatus(deviceName) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const prevOnlineRef = useRef(null);
  
  // Use global device status context
  const { 
    deviceStatuses, 
    subscribeToDevice, 
    hasDeviceStatus,
    connectMqtt,
    sendCommand: contextSendCommand,
  } = useDeviceStatusContext();

  // Get full status from global context
  const deviceStatus = hasDeviceStatus(deviceName) ? deviceStatuses[deviceName] : null;

  // online reflects MQTT connectivity; power reflects the lamp's on/off state
  const isOnline = deviceStatus?.online ?? null;
  const power = deviceStatus?.power ?? null;
  const brightness = deviceStatus?.brightness ?? null;
  const r = deviceStatus?.r ?? null;
  const g = deviceStatus?.g ?? null;
  const b = deviceStatus?.b ?? null;
  const wakeUp = deviceStatus?.wakeUp ?? null;
  const schedules = deviceStatus?.schedules ?? null;
  const sleepTimer = deviceStatus?.sleepTimer ?? null;

  // Track lastSeen when device comes online
  useEffect(() => {
    if (isOnline === true && prevOnlineRef.current !== true) {
      setLastSeen(new Date());
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const connect = useCallback(async () => {
    if (!deviceName) {
      setError('No device name provided');
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Subscribe via global context (handles connection automatically)
      await subscribeToDevice(deviceName);
      setIsConnecting(false);
    } catch (err) {
      console.error('[useDeviceStatus] Error:', err);
      setError(err.message || 'Failed to connect');
      setIsConnecting(false);
    }
  }, [deviceName, subscribeToDevice]);

  useEffect(() => {
    connect();
    // Note: We don't unsubscribe on unmount anymore
    // Global context maintains subscriptions across screens
  }, [connect]);

  const reconnect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      await connectMqtt();
      await subscribeToDevice(deviceName);
      setIsConnecting(false);
    } catch (err) {
      setError(err.message || 'Failed to reconnect');
      setIsConnecting(false);
    }
  }, [connectMqtt, subscribeToDevice, deviceName]);

  // Send command to this device
  const sendCommand = useCallback(async (command) => {
    if (!deviceName) {
      throw new Error('No device name');
    }
    setIsSendingCommand(true);
    try {
      await contextSendCommand(deviceName, command);
    } finally {
      setIsSendingCommand(false);
    }
  }, [deviceName, contextSendCommand]);

  return {
    isOnline,
    power,
    brightness,
    r,
    g,
    b,
    wakeUp,
    schedules,
    sleepTimer,
    isConnecting,
    error,
    lastSeen,
    reconnect,
    sendCommand,
    isSendingCommand,
  };
}

/**
 * Hook to get MQTT connection status
 * @returns {{ isConnected: boolean }}
 */
export function useMqttConnection() {
  const { mqttConnected } = useDeviceStatusContext();
  return { isConnected: mqttConnected };
}

export default useDeviceStatus;
