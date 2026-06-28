/**
 * DeviceControlTabs
 * Bottom tab navigator for device control screens
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import TabBarIcon from './TabBarIcon';
import { colors, fonts } from '../constants/theme';

import DeviceStatusScreen from '../screens/DeviceStatusScreen';
import ColorPickerScreen from '../screens/ColorPickerScreen';
import ScenesScreen from '../screens/ScenesScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import DeviceSettingsScreen from '../screens/DeviceSettingsScreen';

const Tab = createBottomTabNavigator();

const DeviceControlTabs = ({ route }) => {
  const { deviceName, deviceId } = route.params || {};
  const { isOnline, power } = useDeviceStatus(deviceName);

  // Colors/Scenes require the lamp to be powered on; Schedule only requires the device online
  // (so a user can still schedule the lamp to turn ON while it's currently off)
  const isEnabled = isOnline === true && power === true;
  const isScheduleEnabled = isOnline === true;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textPlaceholder,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semiBold,
          fontSize: 12,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DeviceStatusScreen}
        initialParams={{ deviceName, deviceId }}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ColorsTab"
        component={ColorPickerScreen}
        initialParams={{ deviceName, isOnline: isEnabled }}
        options={{
          tabBarLabel: 'Colors',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="palette" color={isEnabled ? color : colors.iconDisabled} focused={focused} />
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
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="lightbulb-group" color={isEnabled ? color : colors.iconDisabled} focused={focused} />
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
        initialParams={{ deviceName, isOnline: isScheduleEnabled }}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="clock-outline" color={isScheduleEnabled ? color : colors.iconDisabled} focused={focused} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (!isScheduleEnabled) {
              e.preventDefault();
            }
          },
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={DeviceSettingsScreen}
        initialParams={{ deviceName, deviceId }}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="cog-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default DeviceControlTabs;
