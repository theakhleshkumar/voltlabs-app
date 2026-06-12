/**
 * DeviceStatusScreen
 * Shows device online/offline status and controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

const DeviceStatusScreen = ({ route, navigation }) => {
  const { deviceName } = route.params || {};
  const {
    isOnline,
    power,
    brightness: deviceBrightness,
    r: deviceR,
    g: deviceG,
    b: deviceB,
    isConnecting,
    error,
    lastSeen,
    reconnect,
    sendCommand,
    isSendingCommand,
  } = useDeviceStatus(deviceName);
  
  // Get screen dimensions for slider width
  const { width: screenWidth } = useWindowDimensions();
  const sliderWidth = screenWidth - 96; // Account for padding (24*2 card + 24*2 screen)

  // Track local brightness for UI responsiveness (syncs with MQTT updates)
  const [brightness, setBrightness] = useState(100);

  // Sync brightness with real device state from MQTT
  useEffect(() => {
    if (deviceBrightness !== null) {
      setBrightness(deviceBrightness);
    }
  }, [deviceBrightness]);

  const formatLastSeen = () => {
    if (!lastSeen) return 'Never';
    const diff = Math.floor((new Date() - lastSeen) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return lastSeen.toLocaleTimeString();
  };

  const handlePowerToggle = async () => {
    if (!isOnline) {
      Alert.alert('Device Offline', 'Cannot control device while offline');
      return;
    }

    // Toggle the lamp's power state (will be confirmed via MQTT state update)
    const newPowerState = !(power === true);

    try {
      await sendCommand({ power: newPowerState });
    } catch (err) {
      Alert.alert('Error', 'Failed to send command to device');
      console.error('Power toggle error:', err);
    }
  };

  const renderStatus = () => {
    // Only show connecting while MQTT is actually connecting
    if (isConnecting) {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.statusText}>Connecting to cloud...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reconnect}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show actual status immediately - ESP32 uses retained messages so we get status right away
    const deviceOnline = isOnline === true;
    const powerOn = power === true;
    
    return (
      <View style={styles.statusContainer}>
        {/* Power Button - Green for ON, Red for OFF */}
        <TouchableOpacity
          style={[
            styles.powerButton,
            powerOn ? styles.powerButtonOn : styles.powerButtonOff,
            !deviceOnline && styles.powerButtonDisabled,
          ]}
          onPress={handlePowerToggle}
          disabled={!deviceOnline || isSendingCommand}
          activeOpacity={0.8}
        >
          {isSendingCommand ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Icon 
              name="power" 
              size={70} 
              color="#fff" 
            />
          )}
        </TouchableOpacity>
        
        <Text style={[
          styles.statusLabel,
          deviceOnline ? styles.onlineLabel : styles.offlineLabel
        ]}>
          {deviceOnline ? 'Online' : 'Offline'}
        </Text>
        <Text style={[
          styles.powerStateText,
          powerOn ? styles.powerStateOn : styles.powerStateOff,
        ]}>
          {powerOn ? 'ON' : 'OFF'}
        </Text>
        {deviceOnline && lastSeen && (
          <Text style={styles.lastSeenText}>Connected {formatLastSeen()}</Text>
        )}
        {!deviceOnline && (
          <Text style={styles.offlineHint}>
            Check that the device is powered on and connected to Wi-Fi
          </Text>
        )}
        
        {/* Brightness Slider */}
        {deviceOnline && powerOn && (
          <View style={styles.brightnessCard}>
            {/* Title */}
            <Text style={styles.brightnessTitle}>Brightness</Text>
            
            {/* React Native Community Slider */}
            <Slider
              style={{ width: sliderWidth, height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={brightness}
              onValueChange={(value) => setBrightness(Math.round(value))}
              onSlidingComplete={(value) => {
                if (isOnline) {
                  sendCommand({ brightness: Math.round(value) }).catch((err) => {
                    console.error('Brightness error:', err);
                  });
                }
              }}
              minimumTrackTintColor="#FFC107"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#FFC107"
            />
            
            {/* Bottom Row: percentage */}
            <View style={styles.brightnessFooter}>
              <Text style={styles.brightnessPercent}>{brightness}%</Text>
            </View>
          </View>
        )}
      </View>
    );
  };



  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderStatus()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    paddingBottom: 16,
  },
  statusContainer: {
    alignItems: 'center',
    padding: 16,
  },
  statusLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  onlineLabel: {
    color: '#059669',
  },
  offlineLabel: {
    color: '#DC2626',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  lastSeenText: {
    fontSize: 14,
    color: '#666',
  },
  offlineHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  powerStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  powerStateOn: {
    color: '#22c55e',
  },
  powerStateOff: {
    color: '#ef4444',
  },
  // Power button styles - solid circular button
  powerButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  powerButtonOn: {
    backgroundColor: '#4ade80',  // Green
  },
  powerButtonOff: {
    backgroundColor: '#ef4444',  // Red
  },
  powerButtonDisabled: {
    opacity: 0.5,
  },
  // Brightness slider styles - neumorphic card design
  brightnessCard: {
    width: '100%',
    marginTop: 32,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  brightnessTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 20,
  },

  brightnessFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  brightnessPercent: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
});

export default DeviceStatusScreen;
