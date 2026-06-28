import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import api from '../services/api';
import { colors, fonts } from '../constants/theme';
import { showToast } from '../components/Toast';

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isValidPhone = phoneNumber.length === 10 && /^\d+$/.test(phoneNumber);

  const handleSendOTP = async () => {
    if (!isValidPhone) {
      showToast('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.sendOtp(phoneNumber);
      
      // In dev mode, log the OTP for testing (stripped from release builds)
      if (__DEV__ && response.devOtp) {
        console.log('[Dev] OTP:', response.devOtp);
      }
      
      navigation.navigate('Otp', { 
        phoneNumber,
        expiresIn: response.expiresIn,
      });
    } catch (error) {
      showToast(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>We'll send you an OTP to verify</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.countryCode}>+91</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          keyboardType="phone-pad"
          maxLength={10}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, (!isValidPhone || isLoading) && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={!isValidPhone || isLoading}>
        {isLoading ? (
          <ActivityIndicator color={colors.dark} />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
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
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  countryCode: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    fontFamily: fonts.regular,
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    color: colors.dark,
    fontSize: 16,
  },
});

export default LoginScreen;
