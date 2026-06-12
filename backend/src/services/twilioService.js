/**
 * Twilio SMS Service
 * Handles OTP generation and sending via Twilio
 */

const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.otpLength = parseInt(process.env.OTP_LENGTH) || 6;
    this.otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    
    // Initialize Twilio client if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } else {
      console.warn('⚠️ Twilio credentials not configured - SMS sending disabled');
    }
  }

  /**
   * Generate a random OTP
   * @returns {string} OTP code
   */
  generateOtp() {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.otpLength; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  /**
   * Get OTP expiry date
   * @returns {Date} Expiry timestamp
   */
  getExpiryDate() {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + this.otpExpiryMinutes);
    return expiry;
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Phone number with country code (e.g., +919876543210)
   * @param {string} otp - OTP code to send
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendOtp(phoneNumber, otp) {
    if (!this.client) {
      // Development mode - log OTP instead of sending
      console.log(`📱 [DEV MODE] OTP for ${phoneNumber}: ${otp}`);
      return { 
        success: true, 
        messageId: 'dev-mode',
        devMode: true,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    try {
      const message = await this.client.messages.create({
        body: `Your VoltLabs verification code is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes.`,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 SMS sent to ${phoneNumber}, SID: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('Twilio error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean}
   */
  isValidPhoneNumber(phone) {
    // Basic validation: starts with + and has 10-15 digits
    const phoneRegex = /^\+[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Format phone number with country code
   * @param {string} phone - Phone number
   * @param {string} countryCode - Country code (default: +91 for India)
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone, countryCode = '+91') {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with country code digits, add +
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    // If 10 digits, assume it needs country code
    if (cleaned.length === 10) {
      return countryCode + cleaned;
    }
    
    // Return as-is with + if not already present
    return phone.startsWith('+') ? phone : '+' + cleaned;
  }
}

module.exports = new TwilioService();
