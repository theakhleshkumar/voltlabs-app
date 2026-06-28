/**
 * Toast
 * Lightweight, non-blocking notification for transient errors/info messages.
 * Use showToast() from anywhere; render <ToastHost /> once near the app root.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../constants/theme';

const DISPLAY_DURATION_MS = 3000;

let toastRef = null;

export const showToast = (message, type = 'error') => {
  toastRef?.show(message, type);
};

const Toast = forwardRef((_props, ref) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('error');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    show(msg, toastType) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setMessage(msg);
      setType(toastType);
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setVisible(false);
        });
      }, DISPLAY_DURATION_MS);
    },
  }));

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, type === 'success' ? styles.success : styles.error, { opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
});

export const ToastHost = () => {
  const innerRef = useRef(null);

  useEffect(() => {
    toastRef = innerRef.current;
    return () => {
      toastRef = null;
    };
  }, []);

  return <Toast ref={innerRef} />;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  error: {
    backgroundColor: colors.dark,
  },
  success: {
    backgroundColor: colors.dark,
  },
  text: {
    fontFamily: fonts.medium,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Toast;
