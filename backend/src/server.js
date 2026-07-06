/**
 * VoltLabs Backend Server
 * Main entry point
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VoltLabs API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Permanently purge accounts whose 30-day deletion grace period has elapsed.
// Soft-deleted in confirmAccountDeletion (authController.js); this is the
// only place the User document itself is ever hard-deleted.
const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const purgeExpiredDeletions = async () => {
  try {
    const cutoff = new Date(Date.now() - DELETION_GRACE_PERIOD_MS);
    const result = await User.deleteMany({
      status: 'pending_deletion',
      deletionRequestedAt: { $lte: cutoff },
    });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Purged ${result.deletedCount} account(s) past the deletion grace period`);
    }
  } catch (error) {
    console.error('Account purge error:', error.message);
  }
};

setInterval(purgeExpiredDeletions, PURGE_CHECK_INTERVAL_MS);
purgeExpiredDeletions();
