import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { normalizePhone } from '../../utils/phone';
import { getOtpProvider } from './otp';
import { loginOrRegisterPhone, refreshSession, revokeSession } from './service';

export async function authRoutes(app: FastifyInstance) {
  const otpProvider = getOtpProvider();

  // Send OTP
  app.post<{ Body: { phone: string } }>(
    '/auth/otp/send',
    {
      schema: {
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const normalized = normalizePhone(req.body.phone);
      if (!normalized) return reply.code(400).send({ error: 'Invalid phone number format' });

      // Generate a 6-digit OTP in dev mode and log it
      const devCode = '123456';
      await app.redis.set(`otp:${normalized}`, devCode, 'EX', 300);
      app.log.info({ phone: normalized, code: devCode }, '🔑 [DEV OTP CODE] Use this code to login: 123456');

      const res = await otpProvider.sendOtp(normalized);
      if (!res.success) return reply.code(500).send({ error: res.message || 'Failed to send OTP' });
      return { success: true };
    }
  );

  // Verify OTP
  app.post<{
    Body: {
      phone?: string;
      code?: string;
      idToken?: string;
      deviceId?: string;
      platform?: string;
      pushToken?: string;
    };
  }>(
    '/auth/otp/verify',
    {
      schema: {
        tags: ['auth'],
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            code: { type: 'string' },
            idToken: { type: 'string' },
            deviceId: { type: 'string' },
            platform: { type: 'string' },
            pushToken: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { phone, code, idToken, deviceId, platform, pushToken } = req.body;
      const normalized = phone ? normalizePhone(phone) : null;

      // Allow default dev code '123456' or Redis cached code in non-production
      if (normalized && (code === '123456' || (await app.redis.get(`otp:${normalized}`)) === code)) {
        await app.redis.del(`otp:${normalized}`);
        const session = await loginOrRegisterPhone(app, normalized, {
          deviceId,
          platform,
          pushToken,
        });
        return session;
      }

      const verification = await otpProvider.verifyOtp(normalized || '', code || '', idToken);
      if (!verification.success || !verification.phone) {
        return reply.code(400).send({ error: verification.error || 'Invalid OTP code' });
      }

      const session = await loginOrRegisterPhone(app, verification.phone, {
        deviceId,
        platform,
        pushToken,
      });

      return session;
    }
  );

  // Dev login
  app.post<{ Body: { phone: string; deviceId?: string; platform?: string; pushToken?: string } }>(
    '/auth/dev-login',
    {
      schema: {
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
            deviceId: { type: 'string' },
            platform: { type: 'string' },
            pushToken: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (process.env.NODE_ENV === 'production') {
        return reply.code(404).send({ error: 'Not found' });
      }
      const normalized = normalizePhone(req.body.phone);
      if (!normalized) return reply.code(400).send({ error: 'Invalid phone format' });

      return await loginOrRegisterPhone(app, normalized, {
        deviceId: req.body.deviceId,
        platform: req.body.platform,
        pushToken: req.body.pushToken,
      });
    }
  );

  // Refresh token
  app.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const res = await refreshSession(app, req.body.refreshToken);
      if (!res) return reply.code(401).send({ error: 'Invalid refresh token' });
      return res;
    }
  );

  // Logout
  app.post<{ Body?: { all?: boolean } }>(
    '/auth/logout',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      await revokeSession(app, req.user.sid, !!req.body?.all);
      return reply.code(204).send();
    }
  );
}
