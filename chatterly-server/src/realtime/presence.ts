import type { Redis } from 'ioredis';

const SOCKET_PREFIX = 'presence:user:';
const HEARTBEAT_TTL_SECONDS = 35;

export const presence = {
  async addSocket(redis: Redis, userId: string, socketId: string): Promise<boolean> {
    const key = `${SOCKET_PREFIX}${userId}`;
    const added = await redis.sadd(key, socketId);
    await redis.expire(key, HEARTBEAT_TTL_SECONDS);
    const count = await redis.scard(key);
    return count === 1 && added === 1; // went online
  },

  async removeSocket(redis: Redis, userId: string, socketId: string): Promise<boolean> {
    const key = `${SOCKET_PREFIX}${userId}`;
    await redis.srem(key, socketId);
    const count = await redis.scard(key);
    if (count === 0) {
      await redis.del(key);
      return true; // went offline
    }
    return false;
  },

  async heartbeat(redis: Redis, userId: string): Promise<void> {
    const key = `${SOCKET_PREFIX}${userId}`;
    await redis.expire(key, HEARTBEAT_TTL_SECONDS);
  },

  async isOnline(redis: Redis, userId: string): Promise<boolean> {
    const key = `${SOCKET_PREFIX}${userId}`;
    const count = await redis.scard(key);
    return count > 0;
  },

  async filterOnline(redis: Redis, userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const pipeline = redis.pipeline();
    for (const id of userIds) {
      pipeline.scard(`${SOCKET_PREFIX}${id}`);
    }
    const results = await pipeline.exec();
    const online = new Set<string>();
    results?.forEach(([err, count], idx) => {
      if (!err && (count as number) > 0) {
        online.add(userIds[idx]);
      }
    });
    return online;
  },
};
