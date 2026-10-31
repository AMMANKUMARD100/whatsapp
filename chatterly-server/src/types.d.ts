import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import type { Server } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    redis: Redis;
    io: Server;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}
