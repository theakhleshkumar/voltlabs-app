/**
 * DeviceSettingsScreen
 * Device-specific settings (remove device, plus room for future settings)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useDeviceStatus as useDeviceStatusContext } from '../context/DeviceStatusContext';
import api from '../services/api';
import { colors, fonts } from '../constants/theme';

const DeviceSettingsScreen = ({ route, navigation }) => {
  const { deviceName, deviceId } = route.params || {};
  const { isOnline, sendCommand } = useDeviceStatus(deviceName);

  // Remove Device flow
  const [isRemoving, setIsRemoving] = useState(false);
  const { unsubscribeFromDevice } = useDeviceStatusContext();

  const handleRemoveDevice = () => {
    const message = isOnline
      ? "This will erase your lamp's Wi-Fi settings, reset it to factory defaults, and permanently remove it from your account. This cannot be undone."
      : "Your lamp appears to be offline, so it can't be reset remotely right now. It will still be permanently removed from your account. This cannot be undone.";

    Alert.alert('Remove Device', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: confirmRemoveDevice },
    ]);
  };

  const confirmRemoveDevice = async () => {
    setIsRemoving(true);
    try {
      if (isOnline) {
        try {
          await sendCommand({ factoryReset: true });
        } catch (err) {
          console.error('[DeviceSettingsScreen] Factory reset command failed:', err);
          // Non-fatal - still unlink the account below
        }
      }
      await api.deleteDevice(deviceId);
      unsubscribeFromDevice(deviceName);
      navigation.goBack();
    } catch (err) {
      setIsRemoving(false);
      Alert.alert('Error', err.message || 'Failed to remove device');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.removeButton, isRemoving && styles.removeButtonDisabled]}
            onPress={handleRemoveDevice}
            disabled={isRemoving}>
            {isRemoving ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={styles.removeButtonText}>Remove Device</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerHint}>
            This resets the lamp to factory settings and removes it from your account.
          </Text>
        </View>
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
  },
  dangerSection: {
    width: '100%',
  },
  dangerSectionTitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPlaceholder,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  removeButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  removeButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.error,
    fontSize: 16,
  },
  dangerHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default DeviceSettingsScreen;
