/**
 * Auth Routes
 * Phone/OTP authentication endpoints
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  sendOtp,
  verifyOtp,
  deviceLogin,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
} = require('../controllers/authController');

// Public routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/device-login', deviceLogin);
router.post('/refresh-token', refreshAccessToken);

// Protected routes
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getProfile);
router.patch('/me', authMiddleware, updateProfile);

module.exports = router;
