/**
 * Routes Index
 * Central route registration for all API endpoints
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const influencerRoutes = require('./influencers');
const campaignRoutes = require('./campaigns');
const modelRoutes = require('./models');
const analyticsRoutes = require('./analytics');

// Health check endpoint (outside /api/v1)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: 'v1'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/influencers', influencerRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/models', modelRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
