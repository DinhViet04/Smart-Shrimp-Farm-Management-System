const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8081',
];

const readString = (config: Record<string, unknown>, key: string) => {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const getAllowedOrigins = (config: Record<string, unknown>) => {
  const configuredOrigins = readString(config, 'CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const frontendUrl = readString(config, 'FRONTEND_URL');
  const production = readString(config, 'NODE_ENV') === 'production';

  return Array.from(
    new Set([
      ...(production ? [] : LOCAL_ORIGINS),
      ...(frontendUrl ? [frontendUrl] : []),
      ...configuredOrigins,
    ]),
  );
};

export const validateEnvironment = (config: Record<string, unknown>) => {
  if (readString(config, 'NODE_ENV') !== 'production') return config;

  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'GOOGLE_CLIENT_ID',
    'FRONTEND_URL',
    'CORS_ORIGINS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ];
  const missing = required.filter((key) => !readString(config, key));
  if (missing.length) {
    throw new Error(`Thiếu biến môi trường production: ${missing.join(', ')}`);
  }

  const placeholderKeys = required.filter((key) =>
    /(CHANGE_ME|GENERATE_|YOUR_|USE_AN_APP_PASSWORD|example\.com)/i.test(
      readString(config, key),
    ),
  );
  if (placeholderKeys.length) {
    throw new Error(
      `Cấu hình production vẫn còn giá trị mẫu: ${placeholderKeys.join(', ')}`,
    );
  }

  const databaseUrl = readString(config, 'DATABASE_URL');
  const directUrl = readString(config, 'DIRECT_URL');
  if (
    !databaseUrl.startsWith('postgresql://') ||
    !directUrl.startsWith('postgresql://')
  ) {
    throw new Error('DATABASE_URL và DIRECT_URL phải là PostgreSQL URL');
  }

  const jwtSecret = readString(config, 'JWT_SECRET');
  const refreshSecret = readString(config, 'JWT_REFRESH_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự');
  }
  if (refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET phải có ít nhất 32 ký tự');
  }
  if (jwtSecret === refreshSecret) {
    throw new Error('JWT_SECRET và JWT_REFRESH_SECRET phải khác nhau');
  }

  if (
    !readString(config, 'GOOGLE_CLIENT_ID').endsWith(
      '.apps.googleusercontent.com',
    )
  ) {
    throw new Error('GOOGLE_CLIENT_ID không hợp lệ');
  }

  const smtpPort = Number(readString(config, 'SMTP_PORT'));
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error('SMTP_PORT không hợp lệ');
  }
  if (!['true', 'false'].includes(readString(config, 'SMTP_SECURE'))) {
    throw new Error('SMTP_SECURE phải là true hoặc false');
  }

  for (const origin of getAllowedOrigins(config)) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS origin không hợp lệ: ${origin}`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`Production CORS origin phải dùng HTTPS: ${origin}`);
    }
    if (url.origin !== origin) {
      throw new Error(`CORS origin phải là origin chính xác: ${origin}`);
    }
  }

  return config;
};
