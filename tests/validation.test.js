/**
 * Validation Unit Tests
 * Tests for form validation and input sanitization
 */

const Validator = require('../src/utils/validation');

describe('Validator Module', () => {
  describe('email validation', () => {
    test('should pass valid email', () => {
      expect(Validator.email('user@example.com')).toBeNull();
      expect(Validator.email('test.user@example.co.uk')).toBeNull();
      expect(Validator.email('user+tag@example.org')).toBeNull();
    });

    test('should fail empty email', () => {
      expect(Validator.email('')).toBe('Email is required');
      expect(Validator.email(null)).toBe('Email is required');
      expect(Validator.email(undefined)).toBe('Email is required');
    });

    test('should fail invalid email formats', () => {
      expect(Validator.email('invalid')).toBe('Please enter a valid email address');
      expect(Validator.email('invalid@')).toBe('Please enter a valid email address');
      expect(Validator.email('@example.com')).toBe('Please enter a valid email address');
      expect(Validator.email('user@')).toBe('Please enter a valid email address');
      expect(Validator.email('user@.com')).toBe('Please enter a valid email address');
    });
  });

  describe('password validation', () => {
    test('should pass valid password', () => {
      expect(Validator.password('SecurePass123!')).toBeNull();
      expect(Validator.password('MyP@ssw0rd')).toBeNull();
    });

    test('should fail empty password', () => {
      expect(Validator.password('')).toBe('Password is required');
      expect(Validator.password(null)).toBe('Password is required');
    });

    test('should fail short password', () => {
      expect(Validator.password('Short1!')).toContain('at least 8 characters');
    });

    test('should fail password without uppercase', () => {
      expect(Validator.password('lowercase123!')).toContain('uppercase');
    });

    test('should fail password without lowercase', () => {
      expect(Validator.password('UPPERCASE123!')).toContain('lowercase');
    });

    test('should fail password without numbers', () => {
      expect(Validator.password('NoNumbers!@#')).toContain('number');
    });
  });

  describe('confirmPassword validation', () => {
    test('should pass matching passwords', () => {
      expect(Validator.confirmPassword('Pass123!', 'Pass123!')).toBeNull();
    });

    test('should fail non-matching passwords', () => {
      expect(Validator.confirmPassword('Pass123!', 'Different1!')).toBe('Passwords do not match');
    });

    test('should fail empty confirm password', () => {
      expect(Validator.confirmPassword('', 'Pass123!')).toBe('Please confirm your password');
    });
  });

  describe('name validation', () => {
    test('should pass valid name', () => {
      expect(Validator.name('John Doe')).toBeNull();
      expect(Validator.name('Jean-Pierre')).toBeNull();
    });

    test('should fail empty name', () => {
      expect(Validator.name('')).toBe('Name is required');
      expect(Validator.name(null)).toBe('Name is required');
    });

    test('should fail too short name', () => {
      expect(Validator.name('J')).toContain('at least 2 characters');
    });

    test('should fail too long name', () => {
      const longName = 'A'.repeat(51);
      expect(Validator.name(longName)).toContain('less than 50 characters');
    });
  });

  describe('required validation', () => {
    test('should pass non-empty value', () => {
      expect(Validator.required('test', 'Field')).toBeNull();
      expect(Validator.required(123, 'Field')).toBeNull();
    });

    test('should fail empty value', () => {
      expect(Validator.required('', 'Name')).toBe('Name is required');
      expect(Validator.required(null, 'Email')).toBe('Email is required');
      expect(Validator.required(undefined, 'Field')).toBe('Field is required');
      expect(Validator.required('   ', 'Name')).toBe('Name is required');
    });
  });

  describe('minLength validation', () => {
    test('should pass when length is sufficient', () => {
      expect(Validator.minLength('hello', 3, 'Text')).toBeNull();
      expect(Validator.minLength('hello', 5, 'Text')).toBeNull();
    });

    test('should fail when length is insufficient', () => {
      expect(Validator.minLength('hi', 5, 'Username')).toContain('at least 5 characters');
    });
  });

  describe('maxLength validation', () => {
    test('should pass when length is within limit', () => {
      expect(Validator.maxLength('hello', 10, 'Text')).toBeNull();
    });

    test('should fail when length exceeds limit', () => {
      expect(Validator.maxLength('hello world', 5, 'Text')).toContain('less than 5 characters');
    });
  });

  describe('pattern validation', () => {
    test('should pass matching pattern', () => {
      const phonePattern = /^\d{10}$/;
      expect(Validator.pattern('1234567890', phonePattern)).toBeNull();
    });

    test('should fail non-matching pattern', () => {
      const phonePattern = /^\d{10}$/;
      expect(Validator.pattern('123', phonePattern, 'Invalid phone number')).toBe('Invalid phone number');
    });
  });
});

describe('Form Validation Integration', () => {
  test('should validate complete registration form', () => {
    const formData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    };

    const errors = {};
    
    const nameError = Validator.name(formData.name);
    if (nameError) errors.name = nameError;

    const emailError = Validator.email(formData.email);
    if (emailError) errors.email = emailError;

    const passwordError = Validator.password(formData.password);
    if (passwordError) errors.password = passwordError;

    const confirmError = Validator.confirmPassword(formData.confirmPassword, formData.password);
    if (confirmError) errors.confirmPassword = confirmError;

    expect(Object.keys(errors)).toHaveLength(0);
  });

  test('should detect multiple validation errors', () => {
    const formData = {
      name: '',
      email: 'invalid-email',
      password: 'short',
      confirmPassword: 'different'
    };

    const errors = {};
    
    const nameError = Validator.name(formData.name);
    if (nameError) errors.name = nameError;

    const emailError = Validator.email(formData.email);
    if (emailError) errors.email = emailError;

    const passwordError = Validator.password(formData.password);
    if (passwordError) errors.password = passwordError;

    const confirmError = Validator.confirmPassword(formData.confirmPassword, formData.password);
    if (confirmError) errors.confirmPassword = confirmError;

    expect(Object.keys(errors)).toBeGreaterThanOrEqual(4);
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(errors.confirmPassword).toBeDefined();
  });
});
