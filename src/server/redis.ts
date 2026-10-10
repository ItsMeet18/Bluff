import { Redis } from '@upstash/redis';

// Support standard Upstash Redis and Vercel KV environment variables
const url =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  process.env.REDIS_URL;

const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.REDIS_TOKEN;

export const isUpstashConfigured = Boolean(url && token);
export const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export interface RedisCommandStat {
  command: string;
  key?: string;
  timestamp: number;
}

export interface RedisStats {
  totalCommands: number;
  byCommand: Record<string, number>;
  recentCommands: RedisCommandStat[];
}

const stats: RedisStats = {
  totalCommands: 0,
  byCommand: {},
  recentCommands: [],
};

export function recordCommand(command: string, key?: string) {
  stats.totalCommands++;
  stats.byCommand[command] = (stats.byCommand[command] || 0) + 1;
  if (stats.recentCommands.length > 500) {
    stats.recentCommands.shift();
  }
  stats.recentCommands.push({ command, key, timestamp: Date.now() });
}

export function getRedisStats(): RedisStats {
  return {
    totalCommands: stats.totalCommands,
    byCommand: { ...stats.byCommand },
    recentCommands: [...stats.recentCommands],
  };
}

export function resetRedisStats(): void {
  stats.totalCommands = 0;
  stats.byCommand = {};
  stats.recentCommands = [];
}

/**
 * In-Memory fallback adapter for offline development and testing
 * when Upstash Redis credentials are not provided in the local environment.
 */
class MemoryRedisStore {
  private kv = new Map<string, { value: any; expireAt?: number }>();
  private zsets = new Map<string, Map<string, number>>();

  private checkProductionWarning() {
    if (isProduction && !isUpstashConfigured) {
      console.warn(
        '⚠️ [BLUFF WARNING]: Running in production without UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. ' +
        'Multiplayer state will not persist across serverless function invocations. ' +
        'Please link Upstash Redis or Vercel KV in your Vercel project Storage tab.'
      );
    }
  }

  private isExpired(entry?: { value: any; expireAt?: number }): boolean {
    if (!entry) return true;
    if (entry.expireAt && Date.now() > entry.expireAt) return true;
    return false;
  }

  private cleanKey(key: string) {
    const entry = this.kv.get(key);
    if (entry && this.isExpired(entry)) {
      this.kv.delete(key);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    recordCommand('get', key);
    this.checkProductionWarning();
    this.cleanKey(key);
    const entry = this.kv.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  async mget<T = any>(...keys: string[]): Promise<(T | null)[]> {
    recordCommand('mget', keys.join(','));
    this.checkProductionWarning();
    return Promise.all(
      keys.map(k => {
        this.cleanKey(k);
        const entry = this.kv.get(k);
        return entry ? (entry.value as T) : null;
      })
    );
  }

  async set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    recordCommand('set', key);
    this.checkProductionWarning();
    this.cleanKey(key);
    if (opts?.nx && this.kv.has(key)) {
      return null;
    }
    const expireAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
    this.kv.set(key, { value, expireAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    recordCommand('del', keys.join(','));
    this.checkProductionWarning();
    let count = 0;
    for (const key of keys) {
      if (this.kv.delete(key) || this.zsets.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    recordCommand('expire', key);
    this.checkProductionWarning();
    const entry = this.kv.get(key);
    if (entry) {
      entry.expireAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async zadd(key: string, memberOrOpts: { score: number; member: string } | { score: number; member: string }[]): Promise<number> {
    recordCommand('zadd', key);
    this.checkProductionWarning();
    if (!this.zsets.has(key)) {
      this.zsets.set(key, new Map());
    }
    const set = this.zsets.get(key)!;
    const items = Array.isArray(memberOrOpts) ? memberOrOpts : [memberOrOpts];
    let added = 0;
    for (const item of items) {
      if (!set.has(item.member)) added++;
      set.set(item.member, item.score);
    }
    return added;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    recordCommand('zrem', key);
    this.checkProductionWarning();
    const set = this.zsets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    return removed;
  }

  async zrange(key: string, min: number | string, max: number | string, opts?: { rev?: boolean }): Promise<string[]> {
    recordCommand('zrange', key);
    this.checkProductionWarning();
    const set = this.zsets.get(key);
    if (!set) return [];
    let entries = Array.from(set.entries());
    if (opts?.rev) {
      entries.sort((a, b) => b[1] - a[1]);
    } else {
      entries.sort((a, b) => a[1] - b[1]);
    }
    const start = typeof min === 'number' ? min : 0;
    const end = typeof max === 'number' ? (max === -1 ? undefined : max + 1) : undefined;
    return entries.slice(start, end).map(e => e[0]);
  }

  async eval<T = any>(script: string, keys: string[], args: any[]): Promise<T> {
    recordCommand('eval', keys.join(','));
    this.checkProductionWarning();
    // Support the standard conditional unlock Lua script:
    // if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end
    if (script.includes('del') && script.includes('get')) {
      const lockKey = keys[0];
      const expectedVal = args[0];
      const entry = this.kv.get(lockKey);
      if (entry && entry.value === expectedVal) {
        this.kv.delete(lockKey);
        return 1 as unknown as T;
      }
      return 0 as unknown as T;
    }
    return 1 as unknown as T;
  }
}

class InstrumentedUpstashRedis implements IRedisClient {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async get<T = any>(key: string): Promise<T | null> {
    recordCommand('get', key);
    return this.client.get<T>(key);
  }

  async mget<T = any>(...keys: string[]): Promise<(T | null)[]> {
    recordCommand('mget', keys.join(','));
    return this.client.mget<T[]>(...keys);
  }

  async set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    recordCommand('set', key);
    return this.client.set(key, value, opts as any);
  }

  async del(...keys: string[]): Promise<number> {
    recordCommand('del', keys.join(','));
    const res = await this.client.del(...keys);
    return res ?? 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    recordCommand('expire', key);
    const res = await this.client.expire(key, seconds);
    return res ?? 0;
  }

  async zadd(key: string, memberOrOpts: { score: number; member: string }): Promise<number> {
    recordCommand('zadd', key);
    const res = await this.client.zadd(key, memberOrOpts as any);
    return res ?? 0;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    recordCommand('zrem', key);
    const res = await this.client.zrem(key, ...members);
    return res ?? 0;
  }

  async zrange(key: string, min: number | string, max: number | string, opts?: { rev?: boolean }): Promise<string[]> {
    recordCommand('zrange', key);
    return this.client.zrange(key, min as any, max as any, opts as any);
  }

  async eval<T = any>(script: string, keys: string[], args: any[]): Promise<T> {
    recordCommand('eval', keys.join(','));
    const res = await this.client.eval(script, keys, args);
    return res as T;
  }
}

export interface IRedisClient {
  get<T = any>(key: string): Promise<T | null>;
  mget<T = any>(...keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  zadd(key: string, memberOrOpts: { score: number; member: string }): Promise<number>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zrange(key: string, min: number | string, max: number | string, opts?: { rev?: boolean }): Promise<string[]>;
  eval<T = any>(script: string, keys: string[], args: any[]): Promise<T>;
}

export const redis: IRedisClient = isUpstashConfigured
  ? new InstrumentedUpstashRedis(new Redis({ url: url!, token: token! }))
  : new MemoryRedisStore();
