/**
 * Auth Routes
 * Phone/OTP authentication endpoints
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
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
  requestAccountDeletion,
  confirmAccountDeletion,
} = require('../controllers/authController');

// Strict rate limit for unauthenticated OTP endpoints only
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
});

// Public routes
router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/device-login', otpLimiter, deviceLogin);
router.post('/refresh-token', otpLimiter, refreshAccessToken);

// Protected routes
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getProfile);
router.patch('/me', authMiddleware, updateProfile);
router.post('/request-account-deletion', authMiddleware, requestAccountDeletion);
router.post('/confirm-account-deletion', authMiddleware, confirmAccountDeletion);

module.exports = router;
