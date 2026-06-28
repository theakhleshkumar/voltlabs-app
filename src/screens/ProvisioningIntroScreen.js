import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts } from '../constants/theme';

const ProvisioningIntroScreen = ({ navigation }) => {
  const bulletPoints = [
    'Bluetooth is used only during setup',
    'Your Wi-Fi details stay private',
    'Setup takes about a minute',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📶</Text>
        <Text style={styles.title}>Connect your Smart Lamp</Text>
        <Text style={styles.description}>
          We'll use Bluetooth to securely connect your phone to the device and
          set up Wi-Fi.
        </Text>

        <View style={styles.bulletContainer}>
          {bulletPoints.map((point, index) => (
            <View key={index} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('PermissionRequest')}>
        <Text style={styles.buttonText}>Continue</Text>
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
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  bulletContainer: {
    paddingHorizontal: 20,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bulletDot: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: '#000',
    marginRight: 12,
    lineHeight: 24,
  },
  bulletText: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    color: '#fff',
    fontSize: 16,
  },
});

export default ProvisioningIntroScreen;
