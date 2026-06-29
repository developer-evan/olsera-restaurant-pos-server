import * as Joi from 'joi';
import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: 3000,
    MONGODB_URI: 'mongodb://localhost:27017/olsera_pos',
    JWT_SECRET: 'a-secure-secret-key-with-enough-length',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    API_PREFIX: 'api/v1',
    CORS_ORIGINS: 'http://localhost:5173',
  };

  it('accepts valid environment variables', () => {
    const { error, value } = envValidationSchema.validate(validEnv);

    expect(error).toBeUndefined();
    expect(value.MONGODB_URI).toBe(validEnv.MONGODB_URI);
    expect(value.PORT).toBe(3000);
  });

  it('rejects missing MONGODB_URI', () => {
    const { MONGODB_URI: _, ...invalidEnv } = validEnv;
    const { error } = envValidationSchema.validate(invalidEnv);

    expect(error).toBeDefined();
    expect(error?.message).toContain('MONGODB_URI');
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      JWT_SECRET: 'too-short',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_SECRET');
  });

  it('applies defaults for optional values', () => {
    const { error, value } = envValidationSchema.validate({
      MONGODB_URI: validEnv.MONGODB_URI,
      JWT_SECRET: validEnv.JWT_SECRET,
    });

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api/v1');
  });
});
