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
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { colors, fonts } from '../constants/theme';
import { showToast } from '../components/Toast';

const DeviceStatusScreen = ({ route }) => {
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
  
  // Get screen width to size cards consistently with screen padding
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 48; // Account for screen padding (24*2) - matches brightnessCard's effective width

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

  // Convert a 0-255 channel value to a 2-digit uppercase hex string
  const toHex = (value) => Math.max(0, Math.min(255, value ?? 0)).toString(16).toUpperCase().padStart(2, '0');

  const handlePowerToggle = async () => {
    if (!isOnline) {
      showToast('Cannot control device while offline');
      return;
    }

    // Toggle the lamp's power state (will be confirmed via MQTT state update)
    const newPowerState = !(power === true);

    try {
      await sendCommand({ power: newPowerState });
    } catch (err) {
      showToast('Failed to send command to device');
      console.error('Power toggle error:', err);
    }
  };

  const renderStatus = () => {
    // Only show connecting while MQTT is actually connecting
    if (isConnecting) {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color={colors.dark} />
          <Text style={styles.statusText}>Connecting to cloud...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.statusContainer}>
          <Icon name="alert-circle-outline" size={48} color={colors.error} style={styles.errorIcon} />
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
        <View style={[styles.statusCard, { width: cardWidth }]}>
          {/* Status badge */}
          <View style={[styles.statusBadge, deviceOnline ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
            <View style={[styles.statusDot, deviceOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
            <Text style={[styles.statusBadgeText, deviceOnline ? styles.onlineLabel : styles.offlineLabel]}>
              {deviceOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

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
          accessibilityRole="button"
          accessibilityLabel={powerOn ? 'Turn lamp off' : 'Turn lamp on'}
          accessibilityState={{ disabled: !deviceOnline || isSendingCommand }}
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
          styles.powerStateText,
          powerOn ? styles.powerStateOn : styles.powerStateOff,
        ]}>
          {powerOn ? 'Lamp is ON' : 'Lamp is OFF'}
        </Text>
        {deviceOnline && (
          <Text style={styles.powerHint}>
            Tap the button to turn {powerOn ? 'off' : 'on'}
          </Text>
        )}
        {deviceOnline && lastSeen && (
          <View style={styles.lastSeenRow}>
            <Icon name="clock-outline" size={14} color={colors.textMuted} />
            <Text style={styles.lastSeenText}>Connected {formatLastSeen()}</Text>
          </View>
        )}
        {!deviceOnline && (
          <Text style={styles.offlineHint}>
            Check that the device is powered on and connected to Wi-Fi
          </Text>
        )}
        </View>
        
        {/* Brightness Slider */}
        {deviceOnline && powerOn && (
          <View style={[styles.brightnessCard, { width: cardWidth }]}>
            {/* Header: title + live value */}
            <View style={styles.brightnessHeader}>
              <Text style={styles.brightnessTitle}>Brightness</Text>
              <Text style={styles.brightnessPercent}>{brightness}%</Text>
            </View>

            {/* Slider with low/high brightness icons */}
            <View style={styles.brightnessSliderRow}>
              <Icon name="brightness-4" size={20} color={colors.textPlaceholder} />
              <Slider
                style={styles.brightnessSlider}
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
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Icon name="brightness-7" size={20} color={colors.textPlaceholder} />
            </View>
          </View>
        )}

        {/* Current Color */}
        {deviceOnline && powerOn && (
          <View style={[styles.colorCard, { width: cardWidth }]}>
            {/* Header: title + hex value */}
            <View style={styles.colorHeader}>
              <Text style={styles.colorTitle}>Current Color</Text>
              <Text style={styles.colorHex}>
                #{toHex(deviceR)}{toHex(deviceG)}{toHex(deviceB)}
              </Text>
            </View>

            {/* Glowing swatch - shadow tints to match the lamp's current color */}
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: `rgb(${deviceR ?? 0}, ${deviceG ?? 0}, ${deviceB ?? 0})`,
                  shadowColor: `rgb(${deviceR ?? 0}, ${deviceG ?? 0}, ${deviceB ?? 0})`,
                },
              ]}
            />
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
  // Status card - wraps power button + status info, mirrors brightness/color cards
  statusCard: {
    width: '100%',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusBadgeOnline: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeOffline: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#059669',
  },
  statusDotOffline: {
    backgroundColor: '#DC2626',
  },
  statusBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  onlineLabel: {
    color: '#059669',
  },
  offlineLabel: {
    color: '#DC2626',
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  statusSubtext: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  lastSeenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  lastSeenText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  offlineHint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPlaceholder,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.semiBold,
    color: '#fff',
    fontSize: 16,
  },
  powerStateText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    marginTop: 16,
    marginBottom: 4,
  },
  powerStateOn: {
    color: '#22c55e',
  },
  powerStateOff: {
    color: '#ef4444',
  },
  powerHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
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
  brightnessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  brightnessTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textSecondary,
  },
  brightnessPercent: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.primary,
  },
  brightnessSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  brightnessSlider: {
    flex: 1,
    height: 40,
  },
  // Current color card - mirrors brightnessCard styling
  colorCard: {
    width: '100%',
    marginTop: 20,
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
  colorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  colorTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textSecondary,
  },
  colorHex: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  colorSwatch: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.border,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
});

export default DeviceStatusScreen;
