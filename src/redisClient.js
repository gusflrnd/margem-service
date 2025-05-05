import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = createClient({ url: redisUrl });

redis.on('error', err => console.error('[redis]', err));
await redis.connect();