import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useDeviceStatus } from '../context/DeviceStatusContext';
import api from '../services/api';
import { showToast } from '../components/Toast';
import { colors, fonts } from '../constants/theme';

const AccountScreen = () => {
  const { user, logout } = useAuth();
  const { subscribeToDevices, sendCommand } = useDeviceStatus();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Delete account flow: confirm -> OTP sent -> OTP modal -> confirm OTP
  const [isStartingDeletion, setIsStartingDeletion] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [isConfirmingDeletion, setIsConfirmingDeletion] = useState(false);
  // Captured before confirmAccountDeletion runs, since that call deletes the
  // Device records server-side - we need the mqttSecret to factory-reset
  // each lamp afterwards.
  const pendingDevicesRef = useRef([]);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      "This will factory-reset and unlink all your lamps immediately, and permanently erase your account in 30 days. This can't be undone. We'll send an OTP to confirm.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: startDeletion },
      ]
    );
  };

  const startDeletion = async () => {
    setIsStartingDeletion(true);
    try {
      const devicesResponse = await api.getDevices();
      pendingDevicesRef.current = devicesResponse?.devices || [];
      await api.requestAccountDeletion();
      setDeleteOtp('');
      setDeleteModalVisible(true);
    } catch (err) {
      showToast(err.message || 'Failed to start account deletion');
    } finally {
      setIsStartingDeletion(false);
    }
  };

  const confirmDeletion = async () => {
    if (deleteOtp.length !== 6) {
      showToast('Please enter the 6-digit OTP');
      return;
    }

    setIsConfirmingDeletion(true);
    try {
      await api.confirmAccountDeletion(deleteOtp);
      setDeleteModalVisible(false);

      // Best-effort factory reset for each lamp - non-fatal if it fails,
      // the account is already scheduled for deletion regardless.
      const devices = pendingDevicesRef.current;
      if (devices.length > 0) {
        try {
          await subscribeToDevices(devices);
          await Promise.all(
            devices.map((device) =>
              sendCommand(device.name, { factoryReset: true }).catch((err) => {
                console.error(`Factory reset failed for ${device.name}:`, err);
              })
            )
          );
        } catch (err) {
          console.error('Device factory reset error:', err);
        }
      }

      showToast('Your account has been deleted.', 'success');
      await logout();
    } catch (err) {
      showToast(err.message || 'Invalid OTP');
    } finally {
      setIsConfirmingDeletion(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Phone Number</Text>
        <Text style={styles.value}>{user?.phone || '—'}</Text>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.logoutButtonText}>Log Out</Text>
        )}
      </TouchableOpacity>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={[styles.deleteButton, isStartingDeletion && styles.logoutButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={isStartingDeletion}>
          {isStartingDeletion ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete My Account</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.dangerHint}>
          Permanently erases your account and unlinks all your lamps.
        </Text>
      </View>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalSubtitle}>
              Enter the OTP sent to {user?.phone || 'your phone'} to permanently delete your account.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteOtp}
              onChangeText={setDeleteOtp}
              placeholder="Enter OTP"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalConfirmButton, isConfirmingDeletion && styles.logoutButtonDisabled]}
              onPress={confirmDeletion}
              disabled={isConfirmingDeletion}>
              {isConfirmingDeletion ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalConfirmButtonText}>Delete Account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setDeleteModalVisible(false)}
              disabled={isConfirmingDeletion}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPlaceholder,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.dark,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.error,
    fontSize: 16,
  },
  dangerSection: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dangerSectionTitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPlaceholder,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontFamily: fonts.semiBold,
    color: '#fff',
    fontSize: 16,
  },
  dangerHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  modalInput: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 6,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalConfirmButton: {
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  modalCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCancelButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default AccountScreen;
