import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import {
  SplashScreen,
  WelcomeScreen,
  LoginScreen,
  OtpScreen,
  HomeScreen,
  AccountScreen,
  AddDeviceScreen,
  SelectDeviceTypeScreen,
  SetupInstructionsScreen,
  ProvisioningIntroScreen,
  PermissionRequestScreen,
  BleScanScreen,
  ProvisioningScreen,
} from '../screens';
import DeviceControlTabs from './DeviceControlTabs';

const Stack = createNativeStackNavigator();

// Shown while AuthContext checks stored tokens / attempts a trusted-device login
const LoadingStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Splash" component={SplashScreen} />
  </Stack.Navigator>
);

// Signed-out flow
const AuthStack = () => (
  <Stack.Navigator initialRouteName="Welcome">
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Otp" component={OtpScreen} />
  </Stack.Navigator>
);

// Signed-in flow
const AppStack = () => (
  <Stack.Navigator initialRouteName="Home">
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Account" component={AccountScreen} />
    <Stack.Screen name="AddDevice" component={AddDeviceScreen} />
    <Stack.Screen name="SelectDeviceType" component={SelectDeviceTypeScreen} />
    <Stack.Screen name="SetupInstructions" component={SetupInstructionsScreen} />
    <Stack.Screen name="ProvisioningIntro" component={ProvisioningIntroScreen} />
    <Stack.Screen name="PermissionRequest" component={PermissionRequestScreen} />
    <Stack.Screen name="BleScan" component={BleScanScreen} />
    <Stack.Screen
      name="Provisioning"
      component={ProvisioningScreen}
      options={{ title: 'Wi-Fi Setup' }}
    />
    <Stack.Screen
      name="DeviceControl"
      component={DeviceControlTabs}
      options={({ route }) => ({
        title: route.params?.deviceName || 'Device',
        headerBackVisible: true,
      })}
    />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingStack />;
  }

  return isAuthenticated ? <AppStack /> : <AuthStack />;
};

export default RootNavigator;
