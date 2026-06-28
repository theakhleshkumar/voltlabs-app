/**
 * MQTT Client for HiveMQ Cloud
 * Handles device status subscriptions after BLE provisioning
 */

import mqtt from 'mqtt';

// HiveMQ Cloud Configuration
// TODO: Move to environment variables or secure config for production
const MQTT_CONFIG = {
  brokerUrl: 'wss://1a7b74bbff1841e78802c83a64b847aa.s1.eu.hivemq.cloud:8884/mqtt',
  username: 'voltlabs_app',
  password: 'Voltlabsapp123@hivemqcluster',
  options: {
    clientId: `voltlabs_app_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    keepalive: 60,
    protocolVersion: 4, // MQTT 3.1.1
  },
};

class MqttClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.deviceStatusCallbacks = new Map(); // deviceName -> callback
    this.deviceTopicIds = new Map(); // deviceName -> topicId ("{deviceId}/{secret}")
    this.topicIdToDeviceName = new Map(); // topicId -> deviceName
    this.connectionCallbacks = [];
    this.reconnecting = false;
    this.connectingPromise = null; // Guard against multiple simultaneous connections
  }

  /**
   * Connect to HiveMQ Cloud
   * @returns {Promise<void>}
   */
  connect() {
    // Already connected
    if (this.client && this.isConnected) {
      console.log('[MQTT] Already connected');
      return Promise.resolve();
    }

    // Connection already in progress - return existing promise
    if (this.connectingPromise) {
      console.log('[MQTT] Connection already in progress, waiting...');
      return this.connectingPromise;
    }

    console.log('[MQTT] Connecting to broker...');

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        // Clean up any existing client
        if (this.client) {
          this.client.end(true);
          this.client = null;
        }

        this.client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
          ...MQTT_CONFIG.options,
          username: MQTT_CONFIG.username,
          password: MQTT_CONFIG.password,
        });

        const timeoutId = setTimeout(() => {
          if (!this.isConnected) {
            console.log('[MQTT] Connection timeout, cleaning up...');
            this.connectingPromise = null;
            this.client?.end(true);
            reject(new Error('MQTT connection timeout'));
          }
        }, MQTT_CONFIG.options.connectTimeout);

        this.client.on('connect', () => {
          console.log('[MQTT] Connected to HiveMQ Cloud');
          clearTimeout(timeoutId);
          this.isConnected = true;
          this.reconnecting = false;
          this.connectingPromise = null;
          this.notifyConnectionChange(true);
          
          // Re-subscribe to all devices after reconnect
          this.resubscribeAll();
          resolve();
        });

        this.client.on('reconnect', () => {
          console.log('[MQTT] Reconnecting...');
          this.reconnecting = true;
        });

        this.client.on('close', () => {
          console.log('[MQTT] Connection closed');
          this.isConnected = false;
          this.notifyConnectionChange(false);
        });

        this.client.on('error', (error) => {
          console.error('[MQTT] Error:', error.message);
          if (!this.isConnected && !this.reconnecting) {
            clearTimeout(timeoutId);
            this.connectingPromise = null;
            reject(error);
          }
        });

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

      } catch (error) {
        console.error('[MQTT] Connection error:', error);
        this.connectingPromise = null;
        reject(error);
      }
    });

    return this.connectingPromise;
  }

  /**
   * Force a fresh reconnect, tearing down the existing socket first.
   * Needed because Android can kill a backgrounded app's socket outright
   * without ever firing 'close', leaving isConnected stuck true on a dead link.
   * @returns {Promise<void>}
   */
  reconnect() {
    console.log('[MQTT] Forcing reconnect...');
    this.isConnected = false;
    this.connectingPromise = null;
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    return this.connect();
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      console.log('[MQTT] Disconnecting...');
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
      this.deviceStatusCallbacks.clear();
      this.deviceTopicIds.clear();
      this.topicIdToDeviceName.clear();
    }
  }

  /**
   * Subscribe to a device's status topic
   * @param {string} deviceName - Device name (e.g., "VoltLabs_Lamp_ABCD"), used as the local lookup key
   * @param {string} topicId - "{deviceId}/{mqttSecret}", used to build the actual MQTT topic
   * @param {function} callback - Called with {online: boolean} when status changes
   * @returns {Promise<void>}
   */
  subscribeToDevice(deviceName, topicId, callback) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('MQTT not connected'));
        return;
      }

      const topic = `voltlabs/${topicId}/status`;
      console.log(`[MQTT] Subscribing to ${topic}`);

      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          console.error(`[MQTT] Subscribe error for ${topic}:`, error);
          reject(error);
        } else {
          console.log(`[MQTT] Subscribed to ${topic}`);
          this.deviceStatusCallbacks.set(deviceName, callback);
          this.deviceTopicIds.set(deviceName, topicId);
          this.topicIdToDeviceName.set(topicId, deviceName);
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from a device's status topic
   * @param {string} deviceName - Device name
   */
  unsubscribeFromDevice(deviceName) {
    if (!this.client) return;

    const topicId = this.deviceTopicIds.get(deviceName);
    if (!topicId) return;

    const topic = `voltlabs/${topicId}/status`;
    console.log(`[MQTT] Unsubscribing from ${topic}`);

    this.client.unsubscribe(topic);
    this.deviceStatusCallbacks.delete(deviceName);
    this.deviceTopicIds.delete(deviceName);
    this.topicIdToDeviceName.delete(topicId);
  }

  /**
   * Re-subscribe to all devices after reconnection
   */
  resubscribeAll() {
    if (!this.client || !this.isConnected) return;

    this.deviceTopicIds.forEach((topicId, deviceName) => {
      const topic = `voltlabs/${topicId}/status`;
      console.log(`[MQTT] Re-subscribing to ${topic}`);
      this.client.subscribe(topic, { qos: 1 });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[MQTT] Message on ${topic}:`, payload);

      // Topic format: voltlabs/{deviceId}/{secret}/status
      const parts = topic.split('/');
      if (parts.length >= 4) {
        const topicId = `${parts[1]}/${parts[2]}`;
        const deviceName = this.topicIdToDeviceName.get(topicId);
        const callback = this.deviceStatusCallbacks.get(deviceName);
        if (callback) {
          callback({
            online: payload.online === true,
            power: payload.power,
            brightness: payload.brightness,
            r: payload.r,
            g: payload.g,
            b: payload.b,
            wakeUp: payload.wakeUp,
            schedules: payload.schedules,
            sleepTimer: payload.sleepTimer,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('[MQTT] Error parsing message:', error);
    }
  }

  /**
   * Add a connection status listener
   * @param {function} callback - Called with (isConnected: boolean)
   */
  onConnectionChange(callback) {
    this.connectionCallbacks.push(callback);
    // Immediately notify current state
    callback(this.isConnected);
  }

  /**
   * Remove a connection status listener
   */
  offConnectionChange(callback) {
    this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Notify all connection listeners
   */
  notifyConnectionChange(isConnected) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('[MQTT] Connection callback error:', error);
      }
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Publish a command to a device
   * @param {string} deviceName - Device name (e.g., "VoltLabs_Lamp_ABCD")
   * @param {object} command - Command object (e.g., { power: true } or { color: "red" })
   * @returns {Promise<void>}
   */
  publishCommand(deviceName, command) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('MQTT not connected'));
        return;
      }

      const topicId = this.deviceTopicIds.get(deviceName);
      if (!topicId) {
        reject(new Error(`No topic registered for device ${deviceName}`));
        return;
      }

      const topic = `voltlabs/${topicId}/command`;
      const payload = JSON.stringify(command);
      
      console.log(`[MQTT] Publishing to ${topic}:`, payload);

      this.client.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          console.error(`[MQTT] Publish error:`, error);
          reject(error);
        } else {
          console.log(`[MQTT] Command published successfully`);
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
const mqttClient = new MqttClient();
export default mqttClient;
