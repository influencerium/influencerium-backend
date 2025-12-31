/**
 * Database Seed Data
 * Populates database with sample data for testing
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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

// Sample data
const sampleUsers = [
  {
    name: 'Admin User',
    email: 'admin@influencerium.com',
    password: 'Admin123!',
    role: 'admin',
    status: 'active'
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password123!',
    role: 'user',
    status: 'active'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'Password123!',
    role: 'user',
    status: 'active'
  }
];

const sampleInfluencers = [
  {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    username: 'alexjohnson',
    platform: 'instagram',
    profile_url: 'https://instagram.com/alexjohnson',
    followers: 150000,
    engagement_rate: 4.5,
    location: 'Los Angeles, CA',
    bio: 'Tech reviewer and lifestyle creator',
    category: 'Technology',
    tags: ['tech', 'lifestyle', 'reviews'],
    status: 'active'
  },
  {
    name: 'Sarah Miller',
    email: 'sarah@example.com',
    username: 'sarahmiller',
    platform: 'tiktok',
    profile_url: 'https://tiktok.com/@sarahmiller',
    followers: 850000,
    engagement_rate: 8.2,
    location: 'New York, NY',
    bio: 'Comedy and entertainment',
    category: 'Entertainment',
    tags: ['comedy', 'funny', 'entertainment'],
    status: 'active'
  },
  {
    name: 'Taylor Chen',
    email: 'taylor@example.com',
    username: 'taylorchen',
    platform: 'youtube',
    profile_url: 'https://youtube.com/@taylorchen',
    followers: 2500000,
    engagement_rate: 6.8,
    location: 'San Francisco, CA',
    bio: 'Gaming content creator',
    category: 'Gaming',
    tags: ['gaming', 'esports', 'streaming'],
    status: 'active'
  },
  {
    name: 'Ryan Wilson',
    email: 'ryan@example.com',
    username: 'ryanwilson',
    platform: 'instagram',
    profile_url: 'https://instagram.com/ryanwilson',
    followers: 320000,
    engagement_rate: 3.9,
    location: 'Miami, FL',
    bio: 'Fitness and wellness advocate',
    category: 'Health & Fitness',
    tags: ['fitness', 'wellness', 'health'],
    status: 'active'
  },
  {
    name: 'Emma Davis',
    email: 'emma@example.com',
    username: 'emmadavis',
    platform: 'youtube',
    profile_url: 'https://youtube.com/@emmadavis',
    followers: 1800000,
    engagement_rate: 5.4,
    location: 'London, UK',
    bio: 'Beauty and fashion expert',
    category: 'Beauty',
    tags: ['beauty', 'fashion', 'makeup'],
    status: 'active'
  },
  {
    name: 'Michael Brown',
    email: 'michael@example.com',
    username: 'michaelbrown',
    platform: 'tiktok',
    profile_url: 'https://tiktok.com/@michaelbrown',
    followers: 450000,
    engagement_rate: 7.1,
    location: 'Toronto, Canada',
    bio: 'Food and cooking enthusiast',
    category: 'Food & Drink',
    tags: ['food', 'cooking', 'recipes'],
    status: 'active'
  },
  {
    name: 'Lisa Wang',
    email: 'lisa@example.com',
    username: 'lisawang',
    platform: 'linkedin',
    profile_url: 'https://linkedin.com/in/lisawang',
    followers: 95000,
    engagement_rate: 3.2,
    location: 'Singapore',
    bio: 'Business and marketing consultant',
    category: 'Business',
    tags: ['business', 'marketing', 'startups'],
    status: 'active'
  },
  {
    name: 'David Kim',
    email: 'david@example.com',
    username: 'davidkim',
    platform: 'twitter',
    profile_url: 'https://twitter.com/davidkim',
    followers: 125000,
    engagement_rate: 2.8,
    location: 'Seoul, South Korea',
    bio: 'Tech news and updates',
    category: 'Technology',
    tags: ['tech', 'news', 'innovation'],
    status: 'active'
  }
];

const sampleCampaigns = [
  {
    name: 'Summer Tech Launch',
    description: 'Promotion campaign for new smartphone launch',
    platform: 'instagram',
    status: 'active',
    start_date: '2025-06-01',
    end_date: '2025-08-31',
    budget: 50000,
    goals: 'Increase brand awareness by 25%',
    target_audience: 'Tech enthusiasts 18-35'
  },
  {
    name: 'Beauty Brand Awareness',
    description: 'New beauty product launch campaign',
    platform: 'youtube',
    status: 'active',
    start_date: '2025-05-15',
    end_date: '2025-07-15',
    budget: 75000,
    goals: 'Reach 1 million impressions',
    target_audience: 'Women 18-45 interested in beauty'
  },
  {
    name: 'Gaming Tournament',
    description: 'Esports tournament sponsorship',
    platform: 'tiktok',
    status: 'draft',
    start_date: '2025-09-01',
    end_date: '2025-09-30',
    budget: 100000,
    goals: 'Engage gaming community',
    target_audience: 'Gamers 18-30'
  },
  {
    name: 'Fitness Challenge',
    description: '30-day fitness challenge campaign',
    platform: 'instagram',
    status: 'completed',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
    budget: 25000,
    goals: '5000 participant signups',
    target_audience: 'Fitness enthusiasts 25-45'
  }
];

const sampleModels = [
  {
    name: 'Instagram Influencer Profile',
    description: 'Data model for Instagram influencer profiles',
    source: 'instagram',
    schema: {
      fields: [
        { name: 'username', type: 'string', required: true },
        { name: 'followers', type: 'number', required: true },
        { name: 'following', type: 'number', required: false },
        { name: 'posts', type: 'number', required: true },
        { name: 'engagement_rate', type: 'number', required: true },
        { name: 'bio', type: 'string', required: false },
        { name: 'verified', type: 'boolean', required: false }
      ]
    },
    is_active: true
  },
  {
    name: 'TikTok Creator Metrics',
    description: 'Data model for TikTok creator metrics',
    source: 'tiktok',
    schema: {
      fields: [
        { name: 'username', type: 'string', required: true },
        { name: 'likes', type: 'number', required: true },
        { name: 'followers', type: 'number', required: true },
        { name: 'shares', type: 'number', required: false },
        { name: 'views', type: 'number', required: true },
        { name: 'engagement_rate', type: 'number', required: true }
      ]
    },
    is_active: true
  },
  {
    name: 'Posted App Model',
    description: 'Data model from postedapp.com influencer data',
    source: 'postedapp',
    schema: {
      fields: [
        { name: 'profile_id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'username', type: 'string', required: true },
        { name: 'platform', type: 'string', required: true },
        { name: 'followers', type: 'number', required: true },
        { name: 'engagement', type: 'number', required: true },
        { name: 'category', type: 'string', required: false },
        { name: 'location', type: 'string', required: false }
      ]
    },
    is_active: true
  }
];

// Seed function
async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...');
    
    // Hash passwords and insert users
    console.log('Creating users...');
    const saltRounds = 12;
    
    for (const user of sampleUsers) {
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);
      await client.query(
        `INSERT INTO users (name, email, password, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email.toLowerCase(), hashedPassword, user.role, user.status]
      );
      console.log(`✓ Created user: ${user.email}`);
    }
    
    // Get user IDs for foreign keys
    const userResult = await client.query('SELECT id, email FROM users LIMIT 1');
    const defaultUserId = userResult.rows[0]?.id;
    
    // Insert influencers
    console.log('\nCreating influencers...');
    for (const influencer of sampleInfluencers) {
      await client.query(
        `INSERT INTO influencers (name, email, username, platform, profile_url, followers, 
                                  engagement_rate, location, bio, category, tags, status, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          influencer.name,
          influencer.email?.toLowerCase(),
          influencer.username,
          influencer.platform,
          influencer.profile_url,
          influencer.followers,
          influencer.engagement_rate,
          influencer.location,
          influencer.bio,
          influencer.category,
          JSON.stringify(influencer.tags),
          influencer.status,
          defaultUserId
        ]
      );
      console.log(`✓ Created influencer: ${influencer.name}`);
    }
    
    // Insert campaigns
    console.log('\nCreating campaigns...');
    for (const campaign of sampleCampaigns) {
      await client.query(
        `INSERT INTO campaigns (name, description, platform, status, start_date, end_date, 
                                budget, goals, target_audience, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          campaign.name,
          campaign.description,
          campaign.platform,
          campaign.status,
          campaign.start_date,
          campaign.end_date,
          campaign.budget,
          campaign.goals,
          campaign.target_audience,
          defaultUserId
        ]
      );
      console.log(`✓ Created campaign: ${campaign.name}`);
    }
    
    // Insert data models
    console.log('\nCreating data models...');
    for (const model of sampleModels) {
      await client.query(
        `INSERT INTO data_models (name, description, source, schema, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          model.name,
          model.description,
          model.source,
          JSON.stringify(model.schema),
          model.is_active,
          defaultUserId
        ]
      );
      console.log(`✓ Created model: ${model.name}`);
    }
    
    // Add some influencers to campaigns
    console.log('\nLinking influencers to campaigns...');
    const campaignResult = await client.query('SELECT id FROM campaigns LIMIT 2');
    const influencerResult = await client.query('SELECT id FROM influencers LIMIT 3');
    
    if (campaignResult.rows.length > 0 && influencerResult.rows.length > 0) {
      await client.query(
        `INSERT INTO campaign_influencers (campaign_id, influencer_id, status, joined_at)
         VALUES ($1, $2, 'active', NOW())
         ON CONFLICT DO NOTHING`,
        [campaignResult.rows[0].id, influencerResult.rows[0].id]
      );
      console.log(`✓ Linked campaign to influencer`);
    }
    
    // Add sample model data
    console.log('\nAdding sample model data...');
    const modelResult = await client.query('SELECT id FROM data_models LIMIT 1');
    if (modelResult.rows.length > 0) {
      const modelId = modelResult.rows[0].id;
      await client.query(
        `INSERT INTO model_data (model_id, data, created_by, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [modelId, JSON.stringify({ username: 'test_user', followers: 10000, engagement: 5.5 }), defaultUserId]
      );
      console.log(`✓ Added sample data point`);
    }
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nSample login credentials:');
    console.log('  Admin: admin@influencerium.com / Admin123!');
    console.log('  User: john@example.com / Password123!');
    
  } catch (error) {
    console.error('Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedDatabase, sampleUsers, sampleInfluencers, sampleCampaigns, sampleModels };
