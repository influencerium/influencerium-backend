/**
 * Utility Functions Unit Tests
 * Tests for common utility functions
 */

describe('Utility Functions', () => {
  describe('generateId', () => {
    const { generateId } = require('../src/utils/helpers');

    test('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
    });

    test('should generate IDs with correct prefix', () => {
      const id = generateId();
      expect(id.startsWith('id_')).toBe(true);
    });

    test('should generate strings', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });
  });

  describe('debounce', () => {
    const { debounce } = require('../src/utils/helpers');

    test('should delay function execution', async () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);
      
      debouncedFunc();
      debouncedFunc();
      debouncedFunc();
      
      expect(func).not.toHaveBeenCalled();
      
      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(func).toHaveBeenCalledTimes(1);
    });

    test('should call function with correct arguments', async () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);
      
      debouncedFunc('arg1', 'arg2');
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    const { throttle } = require('../src/utils/helpers');

    test('should limit function calls', async () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);
      
      throttledFunc();
      throttledFunc();
      throttledFunc();
      
      expect(func).toHaveBeenCalledTimes(1);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      throttledFunc();
      
      expect(func).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatDate', () => {
    const { formatDate } = require('../src/utils/helpers');

    test('should format date in short format', () => {
      const date = new Date('2025-01-15');
      const formatted = formatDate(date, 'short');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });

    test('should format date in long format', () => {
      const date = new Date('2025-01-15');
      const formatted = formatDate(date, 'long');
      
      expect(formatted).toContain('Wednesday');
      expect(formatted).toContain('January');
    });

    test('should include time when specified', () => {
      const date = new Date('2025-01-15T10:30:00');
      const formatted = formatDate(date, 'time');
      
      expect(formatted).toContain(':');
    });
  });

  describe('formatNumber', () => {
    const { formatNumber } = require('../src/utils/helpers');

    test('should format thousands', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(10000)).toBe('10,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    test('should handle small numbers', () => {
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('truncate', () => {
    const { truncate } = require('../src/utils/helpers');

    test('should truncate long text', () => {
      const text = 'This is a very long text that should be truncated';
      const truncated = truncate(text, 20);
      
      expect(truncated.length).toBe(23); // 20 chars + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });

    test('should not truncate short text', () => {
      const text = 'Short text';
      const truncated = truncate(text, 50);
      
      expect(truncated).toBe(text);
    });

    test('should use custom length', () => {
      const text = 'Hello World';
      const truncated = truncate(text, 5);
      
      expect(truncated).toBe('Hello...');
    });
  });

  describe('getInitials', () => {
    const { getInitials } = require('../src/utils/helpers');

    test('should extract initials from name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice Wonderland')).toBe('AW');
    });

    test('should handle single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    test('should handle three word name', () => {
      expect(getInitials('John Robert Doe')).toBe('JR');
    });

    test('should handle lowercase names', () => {
      expect(getInitials('john doe')).toBe('JD');
    });
  });

  describe('getUrlParams', () => {
    const { getUrlParams } = require('../src/utils/helpers');

    test('should parse URL parameters', () => {
      // Mock window.location
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            search: '?page=2&limit=10&sort=name'
          }
        },
        writable: true
      });

      const params = getUrlParams();
      
      expect(params.page).toBe('2');
      expect(params.limit).toBe('10');
      expect(params.sort).toBe('name');
    });

    test('should return empty object for no params', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            search: ''
          }
        },
        writable: true
      });

      const params = getUrlParams();
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe('safeJsonParse', () => {
    const { safeJsonParse } = require('../src/utils/helpers');

    test('should parse valid JSON', () => {
      const result = safeJsonParse('{"name": "test"}', { default: {} });
      expect(result.name).toBe('test');
    });

    test('should return default for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { default: 'fallback' });
      expect(result).toBe('fallback');
    });

    test('should return default for null', () => {
      const result = safeJsonParse(null, { default: 'fallback' });
      expect(result).toBe('fallback');
    });

    test('should parse arrays', () => {
      const result = safeJsonParse('[1, 2, 3]', []);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });
  });

  describe('isInViewport', () => {
    const { isInViewport } = require('../src/utils/helpers');

    beforeEach(() => {
      // Mock getBoundingClientRect
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        top: 100,
        left: 100,
        bottom: 200,
        right: 200,
        width: 100,
        height: 100
      }));
    });

    test('should return true for element in viewport', () => {
      const element = document.createElement('div');
      const result = isInViewport(element);
      expect(result).toBe(true);
    });

    test('should return false for element outside viewport', () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        top: -100,
        left: 100,
        bottom: -50,
        right: 200,
        width: 100,
        height: 100
      }));

      const element = document.createElement('div');
      const result = isInViewport(element);
      expect(result).toBe(false);
    });
  });
});

describe('Storage Utilities', () => {
  const { Storage } = require('../src/utils/storage');

  describe('set and get', () => {
    beforeEach(() => {
      // Mock localStorage
      global.localStorage = {
        store: {},
        setItem(key, value) {
          this.store[key] = value;
        },
        getItem(key) {
          return this.store[key] || null;
        },
        removeItem(key) {
          delete this.store[key];
        },
        clear() {
          this.store = {};
        }
      };
    });

    test('should set and get string value', () => {
      Storage.set('test_key', 'test_value');
      expect(Storage.get('test_key')).toBe('test_value');
    });

    test('should set and get object value', () => {
      const obj = { name: 'test', value: 123 };
      Storage.set('test_obj', obj);
      expect(Storage.get('test_obj')).toEqual(obj);
    });

    test('should return default value when key not found', () => {
      expect(Storage.get('nonexistent')).toBeNull();
      expect(Storage.get('nonexistent', 'default')).toBe('default');
    });

    test('should remove value', () => {
      Storage.set('to_remove', 'value');
      Storage.remove('to_remove');
      expect(Storage.get('to_remove')).toBeNull();
    });

    test('should clear all values', () => {
      Storage.set('key1', 'value1');
      Storage.set('key2', 'value2');
      Storage.clear();
      expect(Storage.get('key1')).toBeNull();
      expect(Storage.get('key2')).toBeNull();
    });
  });
});
