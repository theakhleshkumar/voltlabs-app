/**
 * MainTabs
 * Bottom tab navigator for the signed-in app shell (Home, Account)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import TabBarIcon from './TabBarIcon';
import { colors, fonts } from '../constants/theme';

const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.background,
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
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color, focused }) => (
          <TabBarIcon name="home" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="Account"
      component={AccountScreen}
      options={{
        headerShown: true,
        title: 'Account',
        tabBarIcon: ({ color, focused }) => (
          <TabBarIcon name="account-circle" color={color} focused={focused} />
        ),
      }}
    />
  </Tab.Navigator>
);

export default MainTabs;
