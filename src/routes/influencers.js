/**
 * Influencer Routes
 * Endpoints: CRUD operations for influencers
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, ConflictError } = require('../middleware/error');
const Joi = require('joi');

// Validation Schemas
const createInfluencerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().optional(),
  username: Joi.string().min(2).max(50).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'other').required(),
  profile_url: Joi.string().uri().optional(),
  followers: Joi.number().integer().min(0).optional(),
  engagement_rate: Joi.number().min(0).max(100).optional(),
  location: Joi.string().max(100).optional(),
  bio: Joi.string().max(500).optional(),
  category: Joi.string().max(50).optional(),
  tags: Joi.array().items(Joi.string().max(30)).optional(),
  notes: Joi.string().max(1000).optional()
}).min(2);

const updateInfluencerSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  username: Joi.string().min(2).max(50).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'other').optional(),
  profile_url: Joi.string().uri().optional(),
  followers: Joi.number().integer().min(0).optional(),
  engagement_rate: Joi.number().min(0).max(100).optional(),
  location: Joi.string().max(100).optional(),
  bio: Joi.string().max(500).optional(),
  category: Joi.string().max(50).optional(),
  tags: Joi.array().items(Joi.string().max(30)).optional(),
  notes: Joi.string().max(1000).optional(),
  status: Joi.string().valid('active', 'inactive', 'pending', 'blocked').optional()
}).min(1);

// @route   GET /api/v1/influencers
// @desc    Get all influencers with pagination and filtering
// @access  Private
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  
  // Build filters
  const filters = [];
  const values = [];
  let paramIndex = 1;

  if (req.query.search) {
    filters.push(`(name ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
    values.push(`%${req.query.search}%`);
    paramIndex++;
  }

  if (req.query.platform) {
    filters.push(`platform = $${paramIndex}`);
    values.push(req.query.platform);
    paramIndex++;
  }

  if (req.query.category) {
    filters.push(`category = $${paramIndex}`);
    values.push(req.query.category);
    paramIndex++;
  }

  if (req.query.status) {
    filters.push(`status = $${paramIndex}`);
    values.push(req.query.status);
    paramIndex++;
  }

  if (req.query.minFollowers) {
    filters.push(`followers >= $${paramIndex}`);
    values.push(parseInt(req.query.minFollowers));
    paramIndex++;
  }

  if (req.query.maxFollowers) {
    filters.push(`followers <= $${paramIndex}`);
    values.push(parseInt(req.query.maxFollowers));
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  // Sorting
  const sortField = req.query.sortBy || 'created_at';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const validSortFields = ['name', 'followers', 'engagement_rate', 'created_at', 'updated_at'];
  const actualSortField = validSortFields.includes(sortField) ? sortField : 'created_at';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM influencers ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Get influencers
  const result = await query(
    `SELECT id, name, email, username, platform, profile_url, followers, 
            engagement_rate, location, category, status, tags, 
            created_at, updated_at
     FROM influencers ${whereClause}
     ORDER BY ${actualSortField} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  // Parse tags from JSON string if needed
  const influencers = result.rows.map(inf => ({
    ...inf,
    tags: typeof inf.tags === 'string' ? JSON.parse(inf.tags) : inf.tags
  }));

  res.json({
    success: true,
    data: {
      influencers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @route   GET /api/v1/influencers/:id
// @desc    Get influencer by ID
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, username, platform, profile_url, followers, 
            engagement_rate, location, bio, category, tags, notes, status,
            created_at, updated_at
     FROM influencers WHERE id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Influencer');
  }

  const influencer = result.rows[0];
  influencer.tags = typeof influencer.tags === 'string' ? JSON.parse(influencer.tags) : influencer.tags;

  res.json({
    success: true,
    data: influencer
  });
}));

// @route   POST /api/v1/influencers
// @desc    Create new influencer
// @access  Private
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = createInfluencerSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  // Check for duplicate if username and platform provided
  if (value.username && value.platform) {
    const existing = await query(
      'SELECT id FROM influencers WHERE username = $1 AND platform = $2',
      [value.username, value.platform]
    );

    if (existing.rows.length > 0) {
      throw new ConflictError('Influencer with this username and platform already exists');
    }
  }

  const result = await query(
    `INSERT INTO influencers (name, email, username, platform, profile_url, followers, 
                             engagement_rate, location, bio, category, tags, notes, status, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
     RETURNING *`,
    [
      value.name,
      value.email || null,
      value.username || null,
      value.platform,
      value.profile_url || null,
      value.followers || 0,
      value.engagement_rate || 0,
      value.location || null,
      value.bio || null,
      value.category || null,
      value.tags ? JSON.stringify(value.tags) : '[]',
      value.notes || null,
      'active',
      req.user.id
    ]
  );

  const influencer = result.rows[0];
  influencer.tags = typeof influencer.tags === 'string' ? JSON.parse(influencer.tags) : influencer.tags;

  res.status(201).json({
    success: true,
    message: 'Influencer created successfully',
    data: influencer
  });
}));

// @route   PUT /api/v1/influencers/:id
// @desc    Update influencer
// @access  Private
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = updateInfluencerSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  // Check if influencer exists
  const existing = await query('SELECT id FROM influencers WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Influencer');
  }

  // Build update query
  const updates = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name', 'email', 'username', 'platform', 'profile_url', 'followers',
    'engagement_rate', 'location', 'bio', 'category', 'tags', 'notes', 'status'
  ];

  allowedFields.forEach(field => {
    if (value[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(field === 'tags' ? JSON.stringify(value[field]) : value[field]);
      paramIndex++;
    }
  });

  if (updates.length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const result = await query(
    `UPDATE influencers SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, email, username, platform, profile_url, followers, 
               engagement_rate, location, bio, category, tags, notes, status,
               created_at, updated_at`,
    values
  );

  const influencer = result.rows[0];
  influencer.tags = typeof influencer.tags === 'string' ? JSON.parse(influencer.tags) : influencer.tags;

  res.json({
    success: true,
    message: 'Influencer updated successfully',
    data: influencer
  });
}));

// @route   DELETE /api/v1/influencers/:id
// @desc    Delete influencer
// @access  Private
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const existing = await query('SELECT id FROM influencers WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Influencer');
  }

  await query('DELETE FROM influencers WHERE id = $1', [req.params.id]);

  res.json({
    success: true,
    message: 'Influencer deleted successfully'
  });
}));

// @route   GET /api/v1/influencers/search
// @desc    Search influencers
// @access  Private
router.get('/search/query', authenticate, asyncHandler(async (req, res) => {
  const { q, platform, category, limit } = req.query;
  
  if (!q || q.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters');
  }

  const searchLimit = Math.min(parseInt(limit) || 10, 50);
  const searchTerm = `%${q}%`;

  let whereClause = `name ILIKE $1 OR username ILI1 OR email ILIKE $1`;
  const values = [searchTerm];
  let paramIndex = 2;

  if (platform) {
    whereClause += ` AND platform = $${paramIndex}`;
    values.push(platform);
    paramIndex++;
  }

  if (category) {
    whereClause += ` AND category = $${paramIndex}`;
    values.push(category);
    paramIndex++;
  }

  const result = await query(
    `SELECT id, name, username, platform, followers, engagement_rate, category
     FROM influencers
     WHERE ${whereClause}
     ORDER BY followers DESC
     LIMIT $${paramIndex}`,
    [...values, searchLimit]
  );

  res.json({
    success: true,
    data: result.rows
  });
}));

// @route   GET /api/v1/influencers/stats/overview
// @desc    Get influencer statistics
// @access  Private
router.get('/stats/overview', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
       COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
       SUM(followers) as total_followers,
       AVG(engagement_rate) as avg_engagement_rate,
       COUNT(DISTINCT platform) as platforms_count,
       COUNT(DISTINCT category) as categories_count
     FROM influencers`,
    []
  );

  const stats = result.rows[0];

  // Get top platforms
  const platformStats = await query(
    `SELECT platform, COUNT(*) as count, SUM(followers) as followers
     FROM influencers
     GROUP BY platform
     ORDER BY followers DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      overview: stats,
      byPlatform: platformStats.rows
    }
  });
}));

module.exports = router;
