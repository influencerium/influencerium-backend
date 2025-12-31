/**
 * Jest Test Setup
 * Configure test environment and global mocks
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Increase timeout for async operations
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Allow time for connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Global test utilities
global.testHelpers = {
  /**
   * Generate random test data
   */
  randomEmail() {
    return `test${Date.now()}@example.com`;
  },

  randomString(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Create valid user data
   */
  createUserData(overrides = {}) {
    return {
      name: 'Test User',
      email: this.randomEmail(),
      password: 'TestPass123!',
      confirmPassword: 'TestPass123!',
      role: 'user',
      status: 'active',
      ...overrides
    };
  },

  /**
   * Create valid influencer data
   */
  createInfluencerData(overrides = {}) {
    return {
      name: 'Test Influencer',
      email: this.randomEmail(),
      username: `test_${this.randomString(8)}`,
      platform: 'instagram',
      profile_url: 'https://instagram.com/testuser',
      followers: Math.floor(Math.random() * 1000000),
      engagement_rate: (Math.random() * 10).toFixed(2),
      location: 'Los Angeles, CA',
      bio: 'Test bio',
      category: 'Technology',
      tags: ['test', 'tech'],
      ...overrides
    };
  },

  /**
   * Create valid campaign data
   */
  createCampaignData(overrides = {}) {
    return {
      name: `Test Campaign ${this.randomString(6)}`,
      description: 'Test campaign description',
      platform: 'instagram',
      status: 'draft',
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      budget: 50000,
      goals: 'Increase brand awareness',
      target_audience: 'Tech enthusiasts',
      ...overrides
    };
  },

  /**
   * Create valid data model
   */
  createModelData(overrides = {}) {
    return {
      name: `Test Model ${this.randomString(6)}`,
      description: 'Test data model',
      source: 'instagram',
      schema: {
        fields: [
          { name: 'username', type: 'string', required: true },
          { name: 'followers', type: 'number', required: true }
        ]
      },
      is_active: true,
      ...overrides
    };
  }
};
