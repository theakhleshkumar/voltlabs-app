import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const OtpScreen = ({ route }) => {
  const { login } = useAuth();
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const phoneNumber = route.params?.phoneNumber || '';

  const isValidOtp = otp.length === 6 && /^\d+$/.test(otp);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleVerifyOTP = async () => {
    if (!isValidOtp) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.verifyOtp(phoneNumber, otp);

      if (response.success) {
        // Flip global auth state - RootNavigator will switch to the app stack
        login(response.user);
      }
    } catch (error) {
      Alert.alert('Verification Failed', error.message || 'Invalid OTP');
      // Clear OTP on error
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const response = await api.sendOtp(phoneNumber);
      setOtp('');
      setTimer(30);
      
      // In dev mode, show the OTP (stripped from release builds)
      if (__DEV__ && response.devOtp) {
        Alert.alert('OTP Resent', `Development OTP: ${response.devOtp}`);
      } else {
        Alert.alert('OTP Resent', 'A new OTP has been sent to your phone');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>
        Enter the OTP sent to +91 {phoneNumber}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter OTP"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.button, (!isValidOtp || isLoading) && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={!isValidOtp || isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      <View style={styles.timerContainer}>
        {timer > 0 ? (
          <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
        ) : isResending ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <TouchableOpacity onPress={handleResendOTP}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
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
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 14,
    color: '#666',
  },
  resendText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
});

export default OtpScreen;
