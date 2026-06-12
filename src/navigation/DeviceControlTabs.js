/**
 * DeviceControlTabs
 * Bottom tab navigator for device control screens
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

import DeviceStatusScreen from '../screens/DeviceStatusScreen';
import ColorPickerScreen from '../screens/ColorPickerScreen';
import ScenesScreen from '../screens/ScenesScreen';
import ScheduleScreen from '../screens/ScheduleScreen';

const Tab = createBottomTabNavigator();

const DeviceControlTabs = ({ route }) => {
  const { deviceName } = route.params || {};
  const { isOnline } = useDeviceStatus(deviceName);
  
  // Determine if tabs should be enabled (device is online)
  const isEnabled = isOnline === true;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFC107',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 8,
          paddingBottom: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DeviceStatusScreen}
        initialParams={{ deviceName }}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ColorsTab"
        component={ColorPickerScreen}
        initialParams={{ deviceName, isOnline: isEnabled }}
        options={{
          tabBarLabel: 'Colors',
          tabBarIcon: ({ color, size }) => (
            <Icon name="palette" size={26} color={isEnabled ? color : '#D1D5DB'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!isEnabled) {
              e.preventDefault();
            }
          },
        }}
      />
      <Tab.Screen
        name="ScenesTab"
        component={ScenesScreen}
        initialParams={{ deviceName, isOnline: isEnabled }}
        options={{
          tabBarLabel: 'Scenes',
          tabBarIcon: ({ color, size }) => (
            <Icon name="lightbulb-group" size={26} color={isEnabled ? color : '#D1D5DB'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!isEnabled) {
              e.preventDefault();
            }
          },
        }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={ScheduleScreen}
        initialParams={{ deviceName, isOnline: isEnabled }}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <Icon name="clock-outline" size={26} color={isEnabled ? color : '#D1D5DB'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!isEnabled) {
              e.preventDefault();
            }
          },
        }}
      />
    </Tab.Navigator>
  );
};

export default DeviceControlTabs;
