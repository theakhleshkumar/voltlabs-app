/**
 * Device Routes
 * IoT device management endpoints
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Device = require('../models/Device');
const User = require('../models/User');

/**
 * Get all devices for current user
 * GET /api/devices
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.userId })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.json({ devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

/**
 * Register a new device
 * POST /api/devices
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { deviceId, name, type, wifi, mqttSecret } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Check if device already exists
    let device = await Device.findOne({ deviceId });

    if (device) {
      // Device exists - check if same owner
      if (device.owner.toString() !== req.userId.toString()) {
        return res.status(400).json({ error: 'Device already registered to another user' });
      }
      // Update existing device
      if (name) device.name = name;
      if (wifi) device.wifi = wifi;
      if (mqttSecret) device.mqttSecret = mqttSecret;
      await device.save();
    } else {
      // Create new device
      const deviceName = name || 'Smart Lamp';
      device = new Device({
        deviceId,
        name: deviceName,
        type: type || 'lamp',
        owner: req.userId,
        wifi,
        mqttSecret,
      });
      await device.save();

      // Add to user's devices
      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { devices: device._id },
      });
    }

    res.status(201).json({
      success: true,
      device: {
        id: device._id,
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        status: device.status,
        mqttTopic: device.mqttTopic,
        mqttSecret: device.mqttSecret,
      },
    });
  } catch (error) {
    console.error('Register device error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Device already registered' });
    }
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * Get single device
 * GET /api/devices/:deviceId
 */
router.get('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      owner: req.userId,
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

/**
 * Update device
 * PATCH /api/devices/:deviceId
 */
router.patch('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { name, state } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (state) updates.state = state;

    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId, owner: req.userId },
      updates,
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, device });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

/**
 * Delete device
 * DELETE /api/devices/:deviceId
 */
router.delete('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({
      deviceId: req.params.deviceId,
      owner: req.userId,
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Remove from user's devices
    await User.findByIdAndUpdate(req.userId, {
      $pull: { devices: device._id },
    });

    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

module.exports = router;
