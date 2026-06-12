import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { requestBlePermissions } from '../utils/blePermissions';

const PermissionRequestScreen = ({ navigation }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);


  const permissions = [
    {
      icon: '📶',
      title: 'Bluetooth',
      description: 'to connect to your device',
    },
    {
      icon: '📍',
      title: 'Nearby devices',
      description: 'to find your Smart Lamp',
    },
    {
      icon: '🗺️',
      title: 'Location',
      description: 'required by Android for Bluetooth scanning',
    },
  ];

 const handleAllowPermissions = async () => {
  // If already blocked, do nothing (prevent loop)
  if (permissionBlocked) {
    Alert.alert(
      'Permission Required',
      'Bluetooth permission is disabled. Please enable it from app settings to continue.',
      [{ text: 'OK' }]
    );
    return;
  }

  const result = await requestBlePermissions();

  if (result === 'granted') {
    navigation.navigate('BleScan');
    return;
  }

  // Permission is blocked
  setPermissionBlocked(true);

  Alert.alert(
    'Permission Required',
    'Bluetooth permission is required to connect to your device.',
    [{ text: 'OK' }]
  );
};



  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Permissions needed for setup</Text>
        <Text style={styles.description}>
          To find and connect to your Smart Lamp, we need a few permissions.
        </Text>

        <View style={styles.permissionsList}>
          {permissions.map((permission, index) => (
            <View key={index} style={styles.permissionItem}>
              <Text style={styles.permissionIcon}>{permission.icon}</Text>
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>{permission.title}</Text>
                <Text style={styles.permissionDescription}>
                  {permission.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reassuranceContainer}>
          <Text style={styles.reassuranceText}>
            We only use these permissions during device setup.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          isRequesting && styles.buttonDisabled,
          permissionBlocked && { opacity: 0.5 },
        ]}
        onPress={handleAllowPermissions}
        disabled={isRequesting}>
        <Text style={styles.buttonText}>
          {isRequesting ? 'Requesting...' : 'Allow permissions'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  content: {
    flex: 1,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 40,
  },
  permissionsList: {
    marginBottom: 32,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  permissionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  reassuranceContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
  },
  reassuranceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PermissionRequestScreen;
