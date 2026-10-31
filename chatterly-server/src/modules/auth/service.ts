import type { FastifyInstance } from 'fastify';
import { generateRefreshToken, hashPhone, hashToken } from './tokens';
import { env } from '../../config/env';

export interface DeviceInfo {
  deviceId?: string;
  platform?: string;
  pushToken?: string;
}

export async function loginOrRegisterPhone(
  app: FastifyInstance,
  phone: string,
  device: DeviceInfo
) {
  const phoneHash = hashPhone(phone);
  let user = (
    await app.db.query('SELECT * FROM users WHERE phone = $1', [phone])
  ).rows[0];

  if (!user) {
    const res = await app.db.query(
      `INSERT INTO users (phone, phone_hash, verified_at)
       VALUES ($1, $2, now())
       RETURNING *`,
      [phone, phoneHash]
    );
    user = res.rows[0];
  } else if (!user.verified_at) {
    await app.db.query('UPDATE users SET verified_at = now() WHERE id = $1', [user.id]);
  }

  // Create session
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000);

  const session = (
    await app.db.query(
      `INSERT INTO device_sessions (user_id, refresh_token_hash, device_id, platform, push_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.id, tokenHash, device.deviceId || null, device.platform || null, device.pushToken || null, expiresAt]
    )
  ).rows[0];

  const accessToken = app.jwt.sign(
    { sub: user.id, sid: session.id },
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      about: user.about,
      avatarUrl: user.avatar_url,
    },
  };
}

export async function refreshSession(app: FastifyInstance, rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);
  const { rows } = await app.db.query(
    `SELECT ds.id, ds.user_id, u.phone, u.name, u.about, u.avatar_url
     FROM device_sessions ds
     JOIN users u ON u.id = ds.user_id
     WHERE ds.refresh_token_hash = $1
       AND ds.revoked_at IS NULL
       AND ds.expires_at > now()`,
    [tokenHash]
  );
  if (!rows.length) return null;

  const session = rows[0];
  const newRefreshToken = generateRefreshToken();
  const newHash = hashToken(newRefreshToken);

  await app.db.query(
    'UPDATE device_sessions SET refresh_token_hash = $1, updated_at = now() WHERE id = $2',
    [newHash, session.id]
  );

  const accessToken = app.jwt.sign(
    { sub: session.user_id, sid: session.id },
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: session.user_id,
      phone: session.phone,
      name: session.name,
      about: session.about,
      avatarUrl: session.avatar_url,
    },
  };
}

export async function revokeSession(app: FastifyInstance, sessionId: string, revokeAllForUser = false) {
  if (revokeAllForUser) {
    const { rows } = await app.db.query('SELECT user_id FROM device_sessions WHERE id = $1', [sessionId]);
    if (rows[0]) {
      await app.db.query('UPDATE device_sessions SET revoked_at = now() WHERE user_id = $1', [rows[0].user_id]);
    }
  } else {
    await app.db.query('UPDATE device_sessions SET revoked_at = now() WHERE id = $1', [sessionId]);
  }
}
