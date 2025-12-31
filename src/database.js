/**
 * Database Connection Module (Mock for Local Development)
 * In-memory mock database for testing without PostgreSQL
 */

const crypto = require('crypto');

// In-memory mock data store
const mockStore = {
  users: [],
  influencers: [],
  campaigns: [],
  models: [],
  analytics: []
};

// Helper to generate UUID
function generateId() {
  return crypto.randomUUID();
}

// Helper to hash password (simplified mock)
async function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Mock query function (returns data from in-memory store)
async function query(text, params) {
  const queryLower = text.toLowerCase();
  
  // SELECT queries
  if (queryLower.includes('select')) {
    let result = { rows: [], rowCount: 0 };
    
    if (queryLower.includes('users')) {
      let users = [...mockStore.users];
      
      // Handle WHERE clause for email lookup
      if (queryLower.includes('where') && params && params.length > 0) {
        const emailParam = params[0];
        users = users.filter(user => user.email === emailParam);
      }
      
      result.rows = users;
      result.rowCount = users.length;
    } else if (queryLower.includes('influencers')) {
      result.rows = mockStore.influencers;
      result.rowCount = mockStore.influencers.length;
    } else if (queryLower.includes('campaigns')) {
      result.rows = mockStore.campaigns;
      result.rowCount = mockStore.campaigns.length;
    } else if (queryLower.includes('models')) {
      result.rows = mockStore.models;
      result.rowCount = mockStore.models.length;
    } else if (queryLower.includes('now()')) {
      result.rows = [{ now: new Date().toISOString() }];
      result.rowCount = 1;
    }
    
    return result;
  }
  
  // INSERT/UPDATE/DELETE (simulated)
  if (queryLower.includes('insert')) {
    if (queryLower.includes('users')) {
      // params = [name, email, password, role, status]
      const [name, email, password, role, status] = params || [];
      const newUser = {
        id: generateId(),
        name,
        email,
        password,
        role,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockStore.users.push(newUser);
      return { rows: [newUser], rowCount: 1 };
    }
  }
  
  return { rows: [], rowCount: 0 };
}

// Password verification helper
async function verifyPassword(plainPassword, hashedPassword) {
  // In mock mode, compare the SHA256 hash
  const plainHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
  return plainHash === hashedPassword;
}

// Get a client from the pool (mock)
async function getClient() {
  return {
    query: query,
    release: () => {}
  };
}

// Transaction helper (mock)
async function transaction(callback) {
  return callback({ query });
}

// Check database connection (always succeeds in mock)
async function checkConnection() {
  console.log('Mock database initialized (development mode)');
  return true;
}

// Close the pool (mock)
async function closePool() {
  console.log('Mock database pool closed');
}

// Initialize mock data
async function initMockData() {
  // Create sample users
  mockStore.users = [
    {
      id: '1',
      email: 'brand@example.com',
      password: await hashPassword('password123'),
      role: 'brand',
      name: 'Demo Brand',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      email: 'creator@example.com',
      password: await hashPassword('password123'),
      role: 'creator',
      name: 'Demo Creator',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  // Create sample influencers
  mockStore.influencers = [
    {
      id: '1',
      user_id: '2',
      username: 'democreator',
      platform: 'instagram',
      followers: 50000,
      niche: 'lifestyle',
      engagement_rate: 3.5,
      created_at: new Date().toISOString()
    }
  ];
  
  // Create sample campaigns
  mockStore.campaigns = [
    {
      id: '1',
      brand_id: '1',
      title: 'Summer Campaign 2024',
      description: 'Promote our new summer collection',
      budget: 5000,
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];
  
  console.log('Mock data initialized');
}

module.exports = {
  query,
  getClient,
  transaction,
  pool: {
    connect: getClient,
    end: closePool
  },
  checkConnection,
  closePool,
  mockStore,
  initMockData,
  verifyPassword,
  hashPassword
};

module.exports.default = {
  query,
  getClient,
  transaction,
  pool: {
    connect: getClient,
    end: closePool
  },
  checkConnection,
  closePool,
  mockStore,
  initMockData,
  verifyPassword,
  hashPassword
};