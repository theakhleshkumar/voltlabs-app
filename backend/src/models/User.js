/**
 * User Model
 * Stores user information and OTP for verification
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
  },
  otp: {
    code: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
  },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
  }],
  trustedDevices: [{
    deviceId: { type: String, required: true },
    deviceName: String,
    platform: String,
    token: String,
    lastUsed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
  }],
  devices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
  }],
  lastLogin: Date,
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
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > now);
  return this.save();
};

// Check if OTP is valid
userSchema.methods.isOtpValid = function(code) {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return { valid: false, reason: 'No OTP found' };
  }
  
  if (this.otp.attempts >= 3) {
    return { valid: false, reason: 'Too many attempts' };
  }
  
  if (new Date() > this.otp.expiresAt) {
    return { valid: false, reason: 'OTP expired' };
  }
  
  if (this.otp.code !== code) {
    this.otp.attempts += 1;
    return { valid: false, reason: 'Invalid OTP' };
  }
  
  return { valid: true };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
