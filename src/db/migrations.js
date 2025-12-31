/**
 * Database Migrations
 * Creates all necessary tables for the Influencerium backend
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Load config
const configPath = path.join(__dirname, '..', 'config.yaml');
const configFile = fs.readFileSync(configPath, 'utf8');
const config = yaml.parse(configFile);

// Database connection
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.username,
  password: config.database.password,
  database: config.database.name,
});

// Migration SQL
const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    avatar TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Password Reset Tokens table
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Sessions table
  `CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_info VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
  )`,

  // Influencers table
  `CREATE TABLE IF NOT EXISTS influencers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    username VARCHAR(50),
    platform VARCHAR(50) NOT NULL,
    profile_url TEXT,
    followers INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    location VARCHAR(100),
    bio TEXT,
    category VARCHAR(50),
    tags JSONB DEFAULT '[]',
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Campaigns table
  `CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2) DEFAULT 0,
    goals TEXT,
    target_audience TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Campaign-Influencer junction table
  `CREATE TABLE IF NOT EXISTS campaign_influencers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, influencer_id)
  )`,

  // Data Models table
  `CREATE TABLE IF NOT EXISTS data_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    source VARCHAR(50) NOT NULL,
    schema JSONB NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    data_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Model Data table
  `CREATE TABLE IF NOT EXISTS model_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES data_models(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  )`
];

// Indexes for better query performance
const indexes = [
  // Users indexes
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',

  // Influencers indexes
  'CREATE INDEX IF NOT EXISTS idx_influencers_platform ON influencers(platform)',
  'CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status)',
  'CREATE INDEX IF NOT EXISTS idx_influencers_category ON influencers(category)',
  'CREATE INDEX IF NOT EXISTS idx_influencers_followers ON influencers(followers DESC)',
  'CREATE INDEX IF NOT EXISTS idx_influencers_engagement ON influencers(engagement_rate DESC)',
  'CREATE INDEX IF NOT EXISTS idx_influencers_user_id ON influencers(user_id)',

  // Campaigns indexes
  'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
  'CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform)',
  'CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by)',
  'CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date)',

  // Campaign-Influencers indexes
  'CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign_id ON campaign_influencers(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_campaign_influencers_influencer_id ON campaign_influencers(influencer_id)',

  // Data Models indexes
  'CREATE INDEX IF NOT EXISTS idx_data_models_source ON data_models(source)',
  'CREATE INDEX IF NOT EXISTS idx_data_models_is_active ON data_models(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_data_models_created_by ON data_models(created_by)',

  // Model Data indexes
  'CREATE INDEX IF NOT EXISTS idx_model_data_model_id ON model_data(model_id)',
  'CREATE INDEX IF NOT EXISTS idx_model_data_created_at ON model_data(created_at)',

  // Sessions indexes
  'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'
];

// Run migrations
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migrations...');
    
    // Run table migrations
    for (const migration of migrations) {
      await client.query(migration);
      console.log('✓ Migration completed');
    }
    
    // Create indexes
    for (const index of indexes) {
      await client.query(index);
      console.log('✓ Index created');
    }
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Drop all tables (for development/reset)
async function dropAllTables() {
  const client = await pool.connect();
  
  try {
    console.log('Dropping all tables...');
    
    await client.query('DROP TABLE IF EXISTS model_data CASCADE');
    await client.query('DROP TABLE IF EXISTS campaign_influencers CASCADE');
    await client.query('DROP TABLE IF EXISTS data_models CASCADE');
    await client.query('DROP TABLE IF EXISTS campaigns CASCADE');
    await client.query('DROP TABLE IF EXISTS influencers CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('✅ All tables dropped successfully!');
    
  } catch (error) {
    console.error('Drop failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'drop') {
    dropAllTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    runMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { runMigrations, dropAllTables };