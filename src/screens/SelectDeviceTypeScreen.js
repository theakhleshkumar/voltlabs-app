import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts } from '../constants/theme';

const SelectDeviceTypeScreen = ({ navigation }) => {
  const deviceTypes = [
    {
      id: 1,
      name: 'Smart Lamp',
      icon: '💡',
      enabled: true,
    },
    {
      id: 2,
      name: 'Smart Extension Board',
      icon: '🔌',
      enabled: false,
      comingSoon: true,
    },
  ];

  const handleDeviceSelect = (device) => {
    if (device.enabled) {
      navigation.navigate('SetupInstructions', { deviceType: device.name });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select device type</Text>
      <Text style={styles.subtitle}>Choose the type of device you want to add</Text>

      <View style={styles.deviceList}>
        {deviceTypes.map((device) => (
          <TouchableOpacity
            key={device.id}
            style={[
              styles.deviceCard,
              !device.enabled && styles.deviceCardDisabled,
            ]}
            onPress={() => handleDeviceSelect(device)}
            disabled={!device.enabled}>
            <Text style={styles.deviceIcon}>{device.icon}</Text>
            <View style={styles.deviceInfo}>
              <Text
                style={[
                  styles.deviceName,
                  !device.enabled && styles.deviceNameDisabled,
                ]}>
                {device.name}
              </Text>
              {device.comingSoon && (
                <Text style={styles.comingSoonText}>Coming soon</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  deviceList: {
    gap: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 16,
  },
  deviceCardDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  deviceIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: '#000',
  },
  deviceNameDisabled: {
    color: '#999',
  },
  comingSoonText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SelectDeviceTypeScreen;
