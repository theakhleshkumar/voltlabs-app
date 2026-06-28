/**
 * TabBarIcon
 * Shared icon renderer for bottom tab bars - gives the active tab a
 * soft highlight pill so it's easy to tell which tab is selected.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../constants/theme';

const TabBarIcon = ({ name, color, focused, size = 26 }) => (
  <View style={[styles.wrapper, focused && styles.wrapperActive]}>
    <Icon name={name} size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    width: 56,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapperActive: {
    backgroundColor: colors.primarySoft,
  },
});

export default TabBarIcon;
