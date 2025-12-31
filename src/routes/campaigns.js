/**
 * Campaign Routes
 * Endpoints: CRUD operations for campaigns
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, ConflictError } = require('../middleware/error');
const Joi = require('joi');

// Validation Schemas
const createCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'multi').required(),
  status: Joi.string().valid('draft', 'active', 'paused', 'completed', 'cancelled').default('draft'),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional().greater(Joi.ref('start_date')),
  budget: Joi.number().min(0).optional(),
  goals: Joi.string().max(500).optional(),
  target_audience: Joi.string().max(500).optional(),
  notes: Joi.string().max(1000).optional()
}).min(1);

const updateCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'multi').optional(),
  status: Joi.string().valid('draft', 'active', 'paused', 'completed', 'cancelled').optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  budget: Joi.number().min(0).optional(),
  goals: Joi.string().max(500).optional(),
  target_audience: Joi.string().max(500).optional(),
  notes: Joi.string().max(1000).optional()
}).min(1);

// @route   GET /api/v1/campaigns
// @desc    Get all campaigns with pagination and filtering
// @access  Private
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const filters = [];
  const values = [];
  let paramIndex = 1;

  if (req.query.search) {
    filters.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${req.query.search}%`);
    paramIndex++;
  }

  if (req.query.platform) {
    filters.push(`platform = $${paramIndex}`);
    values.push(req.query.platform);
    paramIndex++;
  }

  if (req.query.status) {
    filters.push(`status = $${paramIndex}`);
    values.push(req.query.status);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM campaigns ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT id, name, description, platform, status, start_date, end_date, 
            budget, goals, target_audience, created_by, created_at, updated_at
     FROM campaigns ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  res.json({
    success: true,
    data: {
      campaigns: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @route   GET /api/v1/campaigns/:id
// @desc    Get campaign by ID
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.*, u.name as creator_name
     FROM campaigns c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Campaign');
  }

  const campaign = result.rows[0];

  // Get campaign influencers
  const influencersResult = await query(
    `SELECT i.*, ci.joined_at, ci.status as participation_status
     FROM influencers i
     JOIN campaign_influencers ci ON i.id = ci.influencer_id
     WHERE ci.campaign_id = $1
     ORDER BY ci.joined_at DESC`,
    [req.params.id]
  );

  campaign.influencers = influencersResult.rows;

  res.json({
    success: true,
    data: campaign
  });
}));

// @route   POST /api/v1/campaigns
// @desc    Create new campaign
// @access  Private
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = createCampaignSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const result = await query(
    `INSERT INTO campaigns (name, description, platform, status, start_date, end_date, 
                           budget, goals, target_audience, notes, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [
      value.name,
      value.description || null,
      value.platform,
      value.status || 'draft',
      value.start_date || null,
      value.end_date || null,
      value.budget || 0,
      value.goals || null,
      value.target_audience || null,
      value.notes || null,
      req.user.id
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Campaign created successfully',
    data: result.rows[0]
  });
}));

// @route   PUT /api/v1/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = updateCampaignSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const existing = await query('SELECT id FROM campaigns WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Campaign');
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name', 'description', 'platform', 'status', 'start_date', 'end_date',
    'budget', 'goals', 'target_audience', 'notes'
  ];

  allowedFields.forEach(field => {
    if (value[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(value[field]);
      paramIndex++;
    }
  });

  if (updates.length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const result = await query(
    `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  res.json({
    success: true,
    message: 'Campaign updated successfully',
    data: result.rows[0]
  });
}));

// @route   DELETE /api/v1/campaigns/:id
// @desc    Delete campaign
// @access  Private
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const existing = await query('SELECT id FROM campaigns WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Campaign');
  }

  await query('DELETE FROM campaign_influencers WHERE campaign_id = $1', [req.params.id]);
  await query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);

  res.json({
    success: true,
    message: 'Campaign deleted successfully'
  });
}));

// @route   POST /api/v1/campaigns/:id/influencers
// @desc    Add influencer to campaign
// @access  Private
router.post('/:id/influencers', authenticate, asyncHandler(async (req, res) => {
  const { influencer_id, status } = req.body;

  if (!influencer_id) {
    throw new ValidationError('Influencer ID is required');
  }

  // Check campaign exists
  const campaign = await query('SELECT id FROM campaigns WHERE id = $1', [req.params.id]);
  if (campaign.rows.length === 0) {
    throw new NotFoundError('Campaign');
  }

  // Check influencer exists
  const influencer = await query('SELECT id FROM influencers WHERE id = $1', [influencer_id]);
  if (influencer.rows.length === 0) {
    throw new NotFoundError('Influencer');
  }

  // Check if already added
  const existing = await query(
    'SELECT id FROM campaign_influencers WHERE campaign_id = $1 AND influencer_id = $2',
    [req.params.id, influencer_id]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('Influencer already added to this campaign');
  }

  const result = await query(
    `INSERT INTO campaign_influencers (campaign_id, influencer_id, status, joined_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [req.params.id, influencer_id, status || 'pending']
  );

  res.status(201).json({
    success: true,
    message: 'Influencer added to campaign',
    data: result.rows[0]
  });
}));

// @route   DELETE /api/v1/campaigns/:id/influencers/:influencerId
// @desc    Remove influencer from campaign
// @access  Private
router.delete('/:id/influencers/:influencerId', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `DELETE FROM campaign_influencers 
     WHERE campaign_id = $1 AND influencer_id = $2`,
    [req.params.id, req.params.influencerId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Campaign influencer relationship');
  }

  res.json({
    success: true,
    message: 'Influencer removed from campaign'
  });
}));

// @route   GET /api/v1/campaigns/stats/overview
// @desc    Get campaign statistics
// @access  Private
router.get('/stats/overview', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
       SUM(budget) as total_budget,
       COUNT(DISTINCT platform) as platforms_count
     FROM campaigns`,
    []
  );

  const stats = result.rows[0];

  // Get campaign performance
  const performance = await query(
    `SELECT status, COUNT(*) as count, SUM(budget) as budget
     FROM campaigns
     GROUP BY status`,
    []
  );

  res.json({
    success: true,
    data: {
      overview: stats,
      byStatus: performance.rows
    }
  });
}));

module.exports = router;
