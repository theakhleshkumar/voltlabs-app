/**
 * Device Model
 * Stores IoT device information linked to users
 */

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  // Device identifier (from BLE name, e.g., "VoltLabs_Lamp_FC5E")
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // User-friendly name
  name: {
    type: String,
    default: 'Smart Lamp',
  },
  // Device type
  type: {
    type: String,
    enum: ['lamp', 'switch', 'sensor', 'other'],
    default: 'lamp',
  },
  // Owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Wi-Fi info (stored after provisioning)
  wifi: {
    ssid: String,
    provisionedAt: Date,
  },
  // Device status
  status: {
    online: { type: Boolean, default: false },
    lastSeen: Date,
  },
  // Device state (for lamps)
  state: {
    isOn: { type: Boolean, default: false },
    brightness: { type: Number, min: 0, max: 100, default: 100 },
    color: {
      r: { type: Number, min: 0, max: 255, default: 255 },
      g: { type: Number, min: 0, max: 255, default: 200 },
      b: { type: Number, min: 0, max: 255, default: 150 },
    },
  },
  // MQTT topic
  mqttTopic: String,
  // Per-device random secret used to namespace MQTT topics
  mqttSecret: String,
  // Firmware version
  firmwareVersion: String,
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
deviceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate MQTT topic based on deviceId + per-device secret
deviceSchema.pre('save', function(next) {
  if (this.mqttSecret) {
    this.mqttTopic = `voltlabs/${this.deviceId}/${this.mqttSecret}/status`;
  }
  next();
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
