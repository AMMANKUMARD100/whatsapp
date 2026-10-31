import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGIN: z.string().default('*'),
    OTP_PROVIDER: z.enum(['firebase', 'twilio']).default('firebase'),
    FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
    S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().min(1).default('chatterly-media'),
    S3_ACCESS_KEY: z.string().min(1).default('chatterly'),
    S3_SECRET_KEY: z.string().min(1).default('chatterlypassword'),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  .superRefine((v, ctx) => {
    const need = (key: keyof typeof v) => {
      if (!v[key]) ctx.addIssue({ code: 'custom', path: [key], message: `required when OTP_PROVIDER=${v.OTP_PROVIDER}` });
    };
    if (v.NODE_ENV === 'production') {
      if (v.OTP_PROVIDER === 'firebase') need('FIREBASE_SERVICE_ACCOUNT_BASE64');
      if (v.OTP_PROVIDER === 'twilio') {
        need('TWILIO_ACCOUNT_SID');
        need('TWILIO_AUTH_TOKEN');
        need('TWILIO_VERIFY_SERVICE_SID');
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
