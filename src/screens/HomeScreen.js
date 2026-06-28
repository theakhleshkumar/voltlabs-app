import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import { useDeviceStatus } from '../context/DeviceStatusContext';
import { colors, fonts } from '../constants/theme';

const HomeScreen = ({ navigation }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  // Use global device status context
  const { deviceStatuses, subscribeToDevices, hasDeviceStatus } = useDeviceStatus();

  const fetchDevices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Ensure API is initialized
      if (!api.isAuthenticated()) {
        await api.init();
      }

      const response = await api.getDevices();
      const deviceList = response?.devices || []; 
      
      if (isMountedRef.current) {
        setDevices(deviceList);
        
        // Subscribe to devices via global context (won't duplicate)
        if (deviceList.length > 0) {
          subscribeToDevices(deviceList);
        }
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to load devices');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [subscribeToDevices]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Small delay to ensure navigation is complete
    const timer = setTimeout(() => {
      fetchDevices();
    }, 100);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      // Note: We don't cleanup MQTT subscriptions here anymore
      // They're managed globally and persist across screens
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDevices();
    });
    return unsubscribe;
  }, [navigation, fetchDevices]);

  // Get real-time status for a device (fallback to db status)
  const getDeviceStatus = (device) => {
    // If we have real-time MQTT status, use that
    if (hasDeviceStatus(device.name)) {
      const status = deviceStatuses[device.name];
      return {
        online: status?.online === true,
        power: status?.power === true,
      };
    }
    // Fallback to database status (no separate power info available)
    return {
      online: device.status?.online || false,
      power: device.status?.online || false,
    };
  };

  const renderDevice = ({ item }) => {
    const { online: isOnline, power: isPowerOn } = getDeviceStatus(item);
    const isLit = isOnline && isPowerOn;

    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => navigation.navigate('DeviceControl', {
          deviceId: item.deviceId,
          deviceName: item.name,
        })}>
        <View style={styles.deviceIconContainer}>
          <Icon
            name={isLit ? 'lightbulb-on' : 'lightbulb-outline'}
            size={36}
            color={isLit ? colors.primary : colors.textMuted}
          />
          <View style={[
            styles.statusDot,
            isLit ? styles.statusOnline : styles.statusOffline
          ]} />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={[
            styles.deviceStatus,
            isLit ? styles.statusTextOnline : styles.statusTextOffline
          ]}>
            {!isOnline ? 'Offline' : (isPowerOn ? 'Power: On' : 'Power: Off')}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Icon name="lightbulb-off-outline" size={80} color={colors.border} style={styles.emptyIcon} />
      <Text style={styles.emptyHeading}>No devices added yet</Text>
      <Text style={styles.emptyText}>
        Add your first VoltLabs device to get started.
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddDevice')}>
        <Text style={styles.addButtonText}>+ Add New Device</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && devices.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Image
            source={require('../assets/images/volt_labs_composite_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading devices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Image
          source={require('../assets/images/volt_labs_composite_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load devices</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchDevices()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : devices.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.deviceId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDevices(true)}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>My Devices</Text>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addDeviceButton}
              onPress={() => navigation.navigate('AddDevice')}>
              <Text style={styles.addDeviceButtonText}>+ Add New Device</Text>
            </TouchableOpacity>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.regular,
    marginTop: 16,
    fontSize: 16,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.error,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.dark,
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    marginBottom: 16,
  },
  addDeviceButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addDeviceButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.dark,
    fontSize: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deviceIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#f9f9f9',
  },
  statusOnline: {
    backgroundColor: '#22c55e',
  },
  statusOffline: {
    backgroundColor: colors.textPlaceholder,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    marginBottom: 4,
  },
  deviceStatus: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  statusTextOnline: {
    color: '#22c55e',
  },
  statusTextOffline: {
    color: colors.textPlaceholder,
  },
  chevron: {
    fontFamily: fonts.regular,
    fontSize: 24,
    color: colors.textPlaceholder,
    marginLeft: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyHeading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  addButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.dark,
    fontSize: 16,
  },
});

export default HomeScreen;
