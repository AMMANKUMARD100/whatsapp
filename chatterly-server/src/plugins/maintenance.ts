import fp from 'fastify-plugin';

const HOUR_MS = 3600 * 1000;

/**
 * Periodically purges expired 24h status stories and old revoked/expired device sessions
 * so database tables stay lean in production.
 */
export default fp(async (app) => {
  const sweep = async () => {
    try {
      await app.db.query('DELETE FROM statuses WHERE expires_at < now()');
      await app.db.query(
        `DELETE FROM device_sessions
         WHERE expires_at < now() - interval '7 days'
            OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')`,
      );
    } catch (err) {
      app.log.warn({ err: (err as Error).message }, 'maintenance sweep failed');
    }
  };

  const timer = setInterval(() => void sweep(), HOUR_MS);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
});
