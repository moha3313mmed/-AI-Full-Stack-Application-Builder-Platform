export interface AppConfiguration {
  port: number;
  cors: {
    origins: string[];
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  ai: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
  };
  s3: {
    bucket?: string;
    region?: string;
  };
}

export default (): AppConfiguration => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-jwt-secret')) {
    throw new Error(
      'JWT_SECRET must be set to a secure value in production. Do not use the default dev secret.',
    );
  }

  if (isProduction && (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'dev-refresh-secret')) {
    throw new Error(
      'JWT_REFRESH_SECRET must be set to a secure value in production. Do not use the default dev secret.',
    );
  }

  return {
    port: parseInt(process.env.PORT || '4000', 10),
    cors: {
      origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    },
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/builder',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
    },
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
    },
  };
};
