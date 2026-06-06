import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isConnected = false;

const createRedisClient = () => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying — app works without Redis
      return Math.min(times * 200, 1000);
    },
  });

  client.on('connect', () => {
    isConnected = true;
    logger.info('Redis connected');
  });

  client.on('error', (err) => {
    if (isConnected) {
      logger.warn('Redis error', { error: err.message });
    }
    isConnected = false;
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
};

/**
 * Attempt connection; failures are non-fatal — the app degrades gracefully.
 */
const connectRedis = async () => {
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
  } catch (err) {
    logger.warn('Redis unavailable — caching disabled', { error: err.message });
    isConnected = false;
  }
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    isConnected = false;
    logger.info('Redis disconnected');
  }
};

// ── Cache helpers ──────────────────────────────────────────────────────────────

/**
 * Returns parsed value or null (on miss or Redis down).
 */
const cacheGet = async (key) => {
  if (!isConnected || !redisClient) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

/**
 * Stores JSON-serialised value with optional TTL (seconds). No-op if Redis down.
 */
const cacheSet = async (key, value, ttlSeconds = 300) => {
  if (!isConnected || !redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silently ignore
  }
};

/**
 * Deletes a single key.
 */
const cacheDel = async (key) => {
  if (!isConnected || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch {
    // silently ignore
  }
};

/**
 * Deletes all keys matching a glob pattern using SCAN (safe on large DBs).
 */
const cacheDelPattern = async (pattern) => {
  if (!isConnected || !redisClient) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // silently ignore
  }
};

export { connectRedis, disconnectRedis, cacheGet, cacheSet, cacheDel, cacheDelPattern };
