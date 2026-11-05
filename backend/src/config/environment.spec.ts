import { getAllowedOrigins, validateEnvironment } from './environment.js';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://ssfm:password@postgres:5432/ssfm',
  DIRECT_URL: 'postgresql://ssfm:password@postgres:5432/ssfm',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  FRONTEND_URL: 'https://app.ssfm.test',
  CORS_ORIGINS: 'https://app.ssfm.test,https://admin.ssfm.test',
  SMTP_HOST: 'smtp.ssfm.test',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'mailer@ssfm.test',
  SMTP_PASS: 'smtp-password',
  SMTP_FROM: 'SSFM <noreply@ssfm.test>',
};

describe('production environment', () => {
  it('accepts a complete production configuration without OpenAI', () => {
    expect(validateEnvironment({ ...productionEnvironment })).toEqual(
      productionEnvironment,
    );
  });

  it('fails fast when production secrets and services are missing', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL.*JWT_SECRET.*JWT_REFRESH_SECRET.*GOOGLE_CLIENT_ID.*SMTP_HOST/s,
    );
  });

  it('rejects weak or reused JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        JWT_SECRET: 'short',
      }),
    ).toThrow('JWT_SECRET phải có ít nhất 32 ký tự');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        JWT_REFRESH_SECRET: productionEnvironment.JWT_SECRET,
      }),
    ).toThrow('JWT_SECRET và JWT_REFRESH_SECRET phải khác nhau');
  });

  it('rejects unreplaced values from the production template', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SMTP_PASS: 'USE_AN_APP_PASSWORD',
      }),
    ).toThrow('Cấu hình production vẫn còn giá trị mẫu: SMTP_PASS');
  });

  it('does not allow localhost origins in production', () => {
    expect(getAllowedOrigins(productionEnvironment)).toEqual([
      'https://app.ssfm.test',
      'https://admin.ssfm.test',
    ]);
  });

  it('keeps local origins available during development', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'development' })).toContain(
      'http://localhost:5173',
    );
  });
});
