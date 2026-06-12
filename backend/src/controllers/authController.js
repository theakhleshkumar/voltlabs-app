/**
 * Auth Controller
 * Handles phone/OTP authentication
 */

const crypto = require('crypto');
const User = require('../models/User');
const twilioService = require('../services/twilioService');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../middleware/auth');

// Trusted device token expiry (90 days)
const TRUSTED_DEVICE_EXPIRY_DAYS = 90;

/**
 * Generate a secure device token
 */
const generateDeviceToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send OTP to phone number
 * POST /api/auth/send-otp
 */
const sendOtp = async (req, res) => {
  try {
    let { phone, countryCode } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Format phone number
    phone = twilioService.formatPhoneNumber(phone, countryCode || '+91');

    // Validate phone number
    if (!twilioService.isValidPhoneNumber(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({ phone });
    }

    // Check rate limiting (max 3 OTPs per 10 minutes)
    if (user.otp && user.otp.expiresAt) {
      const timeSinceLastOtp = Date.now() - (user.otp.expiresAt.getTime() - 5 * 60 * 1000);
      if (timeSinceLastOtp < 60000) { // Less than 1 minute since last OTP
        return res.status(429).json({ 
          error: 'Please wait before requesting another OTP',
          retryAfter: Math.ceil((60000 - timeSinceLastOtp) / 1000),
        });
      }
    }

    // Generate and save OTP
    const otp = twilioService.generateOtp();
    user.otp = {
      code: otp,
      expiresAt: twilioService.getExpiryDate(),
      attempts: 0,
    };
    await user.save();

    // Send OTP via SMS
    const result = await twilioService.sendOtp(phone, otp);

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    // Response
    const response = {
      success: true,
      message: 'OTP sent successfully',
      phone: phone.slice(0, -4) + '****', // Masked phone
      expiresIn: twilioService.otpExpiryMinutes * 60, // seconds
    };

    // In development, include OTP for testing
    if (result.devMode && result.otp) {
      response.devOtp = result.otp;
    }

    res.json(response);
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

/**
 * Verify OTP and login
 * POST /api/auth/verify-otp
 */
const verifyOtp = async (req, res) => {
  try {
    let { phone, otp, countryCode } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    // Format phone number
    phone = twilioService.formatPhoneNumber(phone, countryCode || '+91');

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Validate OTP
    const validation = user.isOtpValid(otp);
    if (!validation.valid) {
      await user.save(); // Save incremented attempts
      return res.status(400).json({ error: validation.reason });
    }

    // Clear OTP and mark phone as verified
    user.otp = undefined;
    user.phoneVerified = true;
    user.lastLogin = new Date();

    // Handle trusted device registration
    const { deviceId, deviceName, platform } = req.body;
    let deviceToken = null;
    
    if (deviceId) {
      // Generate device token for trusted device
      deviceToken = generateDeviceToken();
      const deviceExpiry = new Date();
      deviceExpiry.setDate(deviceExpiry.getDate() + TRUSTED_DEVICE_EXPIRY_DAYS);
      
      // Remove old entry for this device if exists
      user.trustedDevices = user.trustedDevices.filter(d => d.deviceId !== deviceId);
      
      // Add new trusted device
      user.trustedDevices.push({
        deviceId,
        deviceName: deviceName || 'Unknown Device',
        platform: platform || 'unknown',
        token: deviceToken,
        lastUsed: new Date(),
        createdAt: new Date(),
        expiresAt: deviceExpiry,
      });
      
      // Keep max 5 trusted devices
      if (user.trustedDevices.length > 5) {
        user.trustedDevices = user.trustedDevices.slice(-5);
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id, type: 'refresh' });

    // Store refresh token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshExpiry,
    });

    // Clean old refresh tokens (keep max 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    const response = {
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        phoneVerified: user.phoneVerified,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
    
    // Include device token if device was registered
    if (deviceToken) {
      response.deviceToken = deviceToken;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

/**
 * Login with trusted device (skip OTP)
 * POST /api/auth/device-login
 */
const deviceLogin = async (req, res) => {
  try {
    let { phone, deviceId, deviceToken, countryCode } = req.body;

    if (!phone || !deviceId || !deviceToken) {
      return res.status(400).json({ error: 'Phone, deviceId, and deviceToken are required' });
    }

    // Format phone number
    phone = twilioService.formatPhoneNumber(phone, countryCode || '+91');

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ error: 'Device not trusted', requireOtp: true });
    }

    // Find trusted device
    const trustedDevice = user.trustedDevices.find(
      d => d.deviceId === deviceId && d.token === deviceToken
    );

    if (!trustedDevice) {
      return res.status(401).json({ error: 'Device not trusted', requireOtp: true });
    }

    // Check if device token expired
    if (new Date() > trustedDevice.expiresAt) {
      // Remove expired device
      user.trustedDevices = user.trustedDevices.filter(d => d.deviceId !== deviceId);
      await user.save();
      return res.status(401).json({ error: 'Device token expired', requireOtp: true });
    }

    // Update last used timestamp
    trustedDevice.lastUsed = new Date();
    user.lastLogin = new Date();

    // Generate new tokens
    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id, type: 'refresh' });

    // Store refresh token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshExpiry,
    });

    // Clean old refresh tokens (keep max 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Device login successful',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        phoneVerified: user.phoneVerified,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Device login error:', error);
    res.status(500).json({ error: 'Device login failed' });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh-token
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Find user and check if token exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
    if (!tokenExists) {
      // This refresh token is valid JWT but isn't in our stored list anymore -
      // it was already rotated (or revoked) before. Reuse of a rotated token
      // is a sign it may have been stolen, so revoke all sessions for this user.
      user.refreshTokens = [];
      await user.save();
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Rotate: invalidate the used refresh token and issue a new one
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);

    const accessToken = generateAccessToken({ userId: user._id });
    const newRefreshToken = generateRefreshToken({ userId: user._id, type: 'refresh' });

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: refreshExpiry,
    });

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    res.json({
      success: true,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

/**
 * Logout - revoke refresh token
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
      // Remove specific refresh token
      req.user.refreshTokens = req.user.refreshTokens.filter(
        t => t.token !== refreshToken
      );
      await req.user.save();
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-otp -refreshTokens')
      .populate('devices', 'deviceId name type status');

    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        phoneVerified: user.phoneVerified,
        devices: user.devices,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

/**
 * Update user profile
 * PATCH /api/auth/me
 */
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-otp -refreshTokens');

    res.json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  deviceLogin,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
};
