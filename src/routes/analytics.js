/**
 * Analytics Routes
 * Endpoints: Analytics and reporting
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route   GET /api/v1/analytics/overview
// @desc    Get platform overview analytics
// @access  Private
router.get('/overview', authenticate, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT 
      (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
      (SELECT COUNT(*) FROM influencers WHERE status = 'active') as total_influencers,
      (SELECT COUNT(*) FROM campaigns) as total_campaigns,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as active_campaigns,
      (SELECT COUNT(*) FROM data_models) as total_models,
      (SELECT SUM(followers) FROM influencers WHERE status = 'active') as total_reach,
      (SELECT AVG(engagement_rate) FROM influencers WHERE status = 'active') as avg_engagement
  `, []);

  const stats = result.rows[0];

  res.json({
    success: true,
    data: {
      users: parseInt(stats.total_users),
      influencers: parseInt(stats.total_influencers),
      campaigns: {
        total: parseInt(stats.total_campaigns),
        active: parseInt(stats.active_campaigns)
      },
      models: parseInt(stats.total_models),
      reach: parseInt(stats.total_reach) || 0,
      engagement: parseFloat(stats.avg_engagement) || 0
    }
  });
}));

// @route   GET /api/v1/analytics/influencers
// @desc    Get influencer analytics
// @access  Private
router.get('/influencers', authenticate, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  // Get influencer statistics by platform
  const platformStats = await query(`
    SELECT 
      platform,
      COUNT(*) as count,
      SUM(followers) as total_followers,
      AVG(followers) as avg_followers,
      AVG(engagement_rate) as avg_engagement,
      MIN(followers) as min_followers,
      MAX(followers) as max_followers
    FROM influencers 
    WHERE status = 'active'
    GROUP BY platform
    ORDER BY total_followers DESC
  `, []);

  // Get top performers
  const topPerformers = await query(`
    SELECT id, name, username, platform, followers, engagement_rate, category
    FROM influencers 
    WHERE status = 'active'
    ORDER BY engagement_rate DESC
    LIMIT 10
  `, []);

  // Get growth trend (mock data - would need historical table)
  const growthTrend = await query(`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as new_influencers
    FROM influencers
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `, []);

  res.json({
    success: true,
    data: {
      byPlatform: platformStats.rows,
      topPerformers: topPerformers.rows,
      growthTrend: growthTrend.rows.reverse()
    }
  });
}));

// @route   GET /api/v1/analytics/campaigns
// @desc    Get campaign analytics
// @access  Private
router.get('/campaigns', authenticate, asyncHandler(async (req, res) => {
  // Get campaign statistics by status
  const statusStats = await query(`
    SELECT 
      status,
      COUNT(*) as count,
      SUM(budget) as total_budget,
      AVG(budget) as avg_budget
    FROM campaigns
    GROUP BY status
    ORDER BY count DESC
  `, []);

  // Get campaign performance
  const performance = await query(`
    SELECT 
      c.id,
      c.name,
      c.status,
      c.platform,
      c.budget,
      c.start_date,
      c.end_date,
      COUNT(ci.id) as influencer_count
    FROM campaigns c
    LEFT JOIN campaign_influencers ci ON c.id = ci.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT 50
  `, []);

  // Get platform distribution
  const platformDist = await query(`
    SELECT 
      platform,
      COUNT(*) as count,
      AVG(budget) as avg_budget
    FROM campaigns
    GROUP BY platform
    ORDER BY count DESC
  `, []);

  res.json({
    success: true,
    data: {
      byStatus: statusStats.rows,
      recentCampaigns: performance.rows,
      platformDistribution: platformDist.rows
    }
  });
}));

// @route   GET /api/v1/analytics/reach
// @desc    Get reach and engagement analytics
// @access  Private
router.get('/reach', authenticate, asyncHandler(async (req, res) => {
  // Total reach by platform
  const reachByPlatform = await query(`
    SELECT 
      platform,
      SUM(followers) as total_reach,
      COUNT(*) as influencer_count,
      AVG(engagement_rate) as avg_engagement
    FROM influencers 
    WHERE status = 'active'
    GROUP BY platform
    ORDER BY total_reach DESC
  `, []);

  // Engagement rate distribution
  const engagementDistribution = await query(`
    SELECT 
      CASE 
        WHEN engagement_rate < 1 THEN '0-1%'
        WHEN engagement_rate < 2 THEN '1-2%'
        WHEN engagement_rate < 3 THEN '2-3%'
        WHEN engagement_rate < 5 THEN '3-5%'
        WHEN engagement_rate < 10 THEN '5-10%'
        ELSE '10%+'
      END as engagement_range,
      COUNT(*) as count
    FROM influencers 
    WHERE status = 'active'
    GROUP BY 1
    ORDER BY MIN(engagement_rate)
  `, []);

  res.json({
    success: true,
    data: {
      byPlatform: reachByPlatform.rows,
      engagementDistribution: engagementDistribution.rows
    }
  });
}));

// @route   GET /api/v1/analytics/export/csv
// @desc    Export analytics data as CSV
// @access  Private
router.get('/export/csv', authenticate, asyncHandler(async (req, res) => {
  const { type } = req.query; // influencers, campaigns, models

  let data;
  let filename;

  switch (type) {
    case 'influencers':
      data = await query('SELECT * FROM influencers ORDER BY created_at DESC', []);
      filename = 'influencers_export.csv';
      break;
    case 'campaigns':
      data = await query('SELECT * FROM campaigns ORDER BY created_at DESC', []);
      filename = 'campaigns_export.csv';
      break;
    default:
      data = await query(`
        SELECT 'influencers' as type, COUNT(*) as count FROM influencers
        UNION ALL
        SELECT 'campaigns' as type, COUNT(*) as count FROM campaigns
        UNION ALL
        SELECT 'users' as type, COUNT(*) as count FROM users
        UNION ALL
        SELECT 'models' as type, COUNT(*) as count FROM data_models
      `, []);
      filename = 'analytics_summary.csv';
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  if (data.rows.length === 0) {
    return res.send('No data available');
  }

  // Convert to CSV
  const headers = Object.keys(data.rows[0]);
  const csvRows = [headers.join(',')];

  data.rows.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value).replace(/"/g, '""');
    });
    csvRows.push(values.join(','));
  });

  res.send(csvRows.join('\n'));
}));

// @route   GET /api/v1/analytics/summary
// @desc    Get quick summary for dashboard
// @access  Private
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT 
      (SELECT COUNT(*) FROM influencers WHERE status = 'active') as influencers,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as campaigns,
      (SELECT SUM(followers) FROM influencers WHERE status = 'active') as total_reach,
      (SELECT AVG(engagement_rate) FROM influencers WHERE status = 'active') as avg_engagement,
      (SELECT COUNT(*) FROM users WHERE status = 'active') as users,
      (SELECT COUNT(*) FROM data_models) as models
  `, []);

  const stats = result.rows[0];

  res.json({
    success: true,
    data: {
      influencers: parseInt(stats.influencers),
      campaigns: parseInt(stats.campaigns),
      reach: parseInt(stats.total_reach) || 0,
      engagement: parseFloat(stats.avg_engagement) || 0,
      users: parseInt(stats.users),
      models: parseInt(stats.models)
    }
  });
}));

module.exports = router;
