const strongJwtSecret =
  'luxom_prod_key_64_chars_minimum_2026_randomized_value_x9Q7mN4vT2pL8sR6';

const validProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  DATABASE_URL: 'postgresql://postgres:postgres@example.com:5432/lux_om?schema=public',
  JWT_SECRET: strongJwtSecret,
  CORS_ORIGIN: 'https://lux.om,https://www.lux.om',
  FRONTEND_URL: 'https://lux.om',
  EMAIL_DELIVERY_MODE: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'no-reply@example.com',
  SMTP_PASS: 'smtp-password-fixture',
  MAIL_FROM: 'lux.om <no-reply@lux.om>',
  GOOGLE_OAUTH_ENABLED: 'true',
  GOOGLE_CLIENT_ID: 'google-client-id-fixture.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-client-secret-fixture',
  GOOGLE_OAUTH_REDIRECT_URL: 'https://api.lux.om/api/auth/google/callback',
  RATE_LIMIT_TRUST_PROXY_HOPS: '1',
  STORAGE_DRIVER: 'cloudinary',
  CLOUDINARY_CLOUD_NAME: 'lux-om-fixture',
  CLOUDINARY_API_KEY: 'cloudinary-key-fixture',
  CLOUDINARY_API_SECRET: 'cloudinary-secret-fixture',
  CLOUDINARY_FOLDER: 'lux-om'
};

Object.assign(process.env, validProductionEnv);

let validateEnv: (input: NodeJS.ProcessEnv) => unknown;

function expectValid(name: string, input: NodeJS.ProcessEnv) {
  validateEnv(input);
  console.log(`✓ ${name}`);
}

function expectInvalid(
  name: string,
  overrides: NodeJS.ProcessEnv,
  expectedMessagePart: string
) {
  try {
    validateEnv({
      ...validProductionEnv,
      ...overrides
    });

    throw new Error(`Expected invalid config for ${name}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    if (!message.includes(expectedMessagePart)) {
      throw new Error(
        `Expected ${name} to fail with "${expectedMessagePart}", got: ${message}`
      );
    }

    console.log(`✓ ${name}`);
  }
}

async function main() {
  const envModule = await import('../src/config/env');
  validateEnv = envModule.validateEnv;

  expectValid('valid production auth environment', validProductionEnv);
  
  expectInvalid('weak production JWT secret', {
    JWT_SECRET: 'replace-this-with-a-long-random-secret-value'
  }, 'JWT_SECRET');
  
  expectInvalid('missing production frontend URL', {
    FRONTEND_URL: ''
  }, 'FRONTEND_URL');
  
  expectInvalid('localhost production frontend URL', {
    FRONTEND_URL: 'http://localhost:5173'
  }, 'FRONTEND_URL');
  
  expectInvalid('localhost production CORS origin', {
    CORS_ORIGIN: 'http://localhost:5173'
  }, 'CORS_ORIGIN');
  
  expectInvalid('development email mode in production', {
    EMAIL_DELIVERY_MODE: 'dev'
  }, 'EMAIL_DELIVERY_MODE');
  
  expectInvalid('missing production SMTP config', {
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    MAIL_FROM: ''
  }, 'SMTP email configuration is required in production');
  
  expectInvalid('localhost Google OAuth redirect', {
    GOOGLE_OAUTH_REDIRECT_URL: 'http://localhost:4000/api/auth/google/callback'
  }, 'GOOGLE_OAUTH_REDIRECT_URL');
  
  expectInvalid('wrong Google OAuth callback path', {
    GOOGLE_OAUTH_REDIRECT_URL: 'https://api.lux.om/api/auth/google/wrong'
  }, '/api/auth/google/callback');
  
  expectInvalid('disabled production trust proxy hops', {
    RATE_LIMIT_TRUST_PROXY_HOPS: '0'
  }, 'RATE_LIMIT_TRUST_PROXY_HOPS');
  
  console.log('Production auth/security environment validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
