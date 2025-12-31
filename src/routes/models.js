/**
 * Data Models Routes
 * Endpoints: CRUD operations for data models
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, ConflictError } = require('../middleware/error');
const Joi = require('joi');

// Validation Schemas
const createModelSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  source: Joi.string().valid('postedapp', 'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'custom').required(),
  schema: Joi.object().required(),
  settings: Joi.object().optional(),
  is_active: Joi.boolean().default(true)
});

const updateModelSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  schema: Joi.object().optional(),
  settings: Joi.object().optional(),
  is_active: Joi.boolean().optional()
}).min(1);

const addDataPointSchema = Joi.object({
  data: Joi.object().required()
});

// @route   GET /api/v1/models
// @desc    Get all data models
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

  if (req.query.source) {
    filters.push(`source = $${paramIndex}`);
    values.push(req.query.source);
    paramIndex++;
  }

  if (req.query.is_active !== undefined) {
    filters.push(`is_active = $${paramIndex}`);
    values.push(req.query.is_active === 'true');
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM data_models ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT id, name, description, source, schema, settings, is_active, 
            data_count, created_by, created_at, updated_at
     FROM data_models ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  res.json({
    success: true,
    data: {
      models: result.rows.map(model => ({
        ...model,
        schema: typeof model.schema === 'string' ? JSON.parse(model.schema) : model.schema,
        settings: typeof model.settings === 'string' ? JSON.parse(model.settings) : model.settings
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @route   GET /api/v1/models/:id
// @desc    Get data model by ID
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT m.*, u.name as creator_name
     FROM data_models m
     LEFT JOIN users u ON m.created_by = u.id
     WHERE m.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Data Model');
  }

  const model = result.rows[0];
  model.schema = typeof model.schema === 'string' ? JSON.parse(model.schema) : model.schema;
  model.settings = typeof model.settings === 'string' ? JSON.parse(model.settings) : model.settings;

  res.json({
    success: true,
    data: model
  });
}));

// @route   POST /api/v1/models
// @desc    Create new data model
// @access  Private
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = createModelSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  // Check for duplicate name
  const existing = await query(
    'SELECT id FROM data_models WHERE name = $1',
    [value.name]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('A model with this name already exists');
  }

  const result = await query(
    `INSERT INTO data_models (name, description, source, schema, settings, is_active, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [
      value.name,
      value.description || null,
      value.source,
      JSON.stringify(value.schema),
      value.settings ? JSON.stringify(value.settings) : '{}',
      value.is_active !== undefined ? value.is_active : true,
      req.user.id
    ]
  );

  const model = result.rows[0];
  model.schema = typeof model.schema === 'string' ? JSON.parse(model.schema) : model.schema;
  model.settings = typeof model.settings === 'string' ? JSON.parse(model.settings) : model.settings;

  res.status(201).json({
    success: true,
    message: 'Data model created successfully',
    data: model
  });
}));

// @route   PUT /api/v1/models/:id
// @desc    Update data model
// @access  Private
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = updateModelSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const existing = await query('SELECT id FROM data_models WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Data Model');
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  const fieldMap = {
    name: 'name',
    description: 'description',
    source: 'source',
    is_active: 'is_active'
  };

  Object.keys(fieldMap).forEach(key => {
    if (value[key] !== undefined) {
      updates.push(`${fieldMap[key]} = $${paramIndex}`);
      values.push(value[key]);
      paramIndex++;
    }
  });

  if (value.schema !== undefined) {
    updates.push(`schema = $${paramIndex}`);
    values.push(JSON.stringify(value.schema));
    paramIndex++;
  }

  if (value.settings !== undefined) {
    updates.push(`settings = $${paramIndex}`);
    values.push(JSON.stringify(value.settings));
    paramIndex++;
  }

  if (updates.length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const result = await query(
    `UPDATE data_models SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  const model = result.rows[0];
  model.schema = typeof model.schema === 'string' ? JSON.parse(model.schema) : model.schema;
  model.settings = typeof model.settings === 'string' ? JSON.parse(model.settings) : model.settings;

  res.json({
    success: true,
    message: 'Data model updated successfully',
    data: model
  });
}));

// @route   DELETE /api/v1/models/:id
// @desc    Delete data model
// @access  Private
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const existing = await query('SELECT id FROM data_models WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Data Model');
  }

  // Delete associated data first
  await query('DELETE FROM model_data WHERE model_id = $1', [req.params.id]);
  await query('DELETE FROM data_models WHERE id = $1', [req.params.id]);

  res.json({
    success: true,
    message: 'Data model deleted successfully'
  });
}));

// @route   GET /api/v1/models/:id/data
// @desc    Get data points for a model
// @access  Private
router.get('/:id/data', authenticate, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;

  const model = await query('SELECT id, name, schema FROM data_models WHERE id = $1', [req.params.id]);
  if (model.rows.length === 0) {
    throw new NotFoundError('Data Model');
  }

  const countResult = await query(
    'SELECT COUNT(*) FROM model_data WHERE model_id = $1',
    [req.params.id]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT * FROM model_data WHERE model_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.id, limit, offset]
  );

  res.json({
    success: true,
    data: {
      model_name: model.rows[0].name,
      data_points: result.rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @route   POST /api/v1/models/:id/data
// @desc    Add data point to model
// @access  Private
router.post('/:id/data', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = addDataPointSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }

  const model = await query('SELECT id, name, schema FROM data_models WHERE id = $1', [req.params.id]);
  if (model.rows.length === 0) {
    throw new NotFoundError('Data Model');
  }

  const result = await query(
    `INSERT INTO model_data (model_id, data, created_by, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [req.params.id, JSON.stringify(value.data), req.user.id]
  );

  // Update data count
  await query(
    `UPDATE data_models SET data_count = data_count + 1, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );

  const dataPoint = result.rows[0];
  dataPoint.data = typeof dataPoint.data === 'string' ? JSON.parse(dataPoint.data) : dataPoint.data;

  res.status(201).json({
    success: true,
    message: 'Data point added successfully',
    data: dataPoint
  });
}));

// @route   DELETE /api/v1/models/:id/data/:dataId
// @desc    Delete data point from model
// @access  Private
router.delete('/:id/data/:dataId', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM model_data WHERE id = $1 AND model_id = $2 RETURNING id',
    [req.params.dataId, req.params.id]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Data Point');
  }

  // Update data count
  await query(
    `UPDATE data_models SET data_count = GREATEST(0, data_count - 1), updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );

  res.json({
    success: true,
    message: 'Data point deleted successfully'
  });
}));

module.exports = router;
