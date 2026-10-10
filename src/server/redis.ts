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
    this.checkProductionWarning();
    this.cleanKey(key);
    const entry = this.kv.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  async set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    this.checkProductionWarning();
    this.cleanKey(key);
    if (opts?.nx && this.kv.has(key)) {
      return null;
    }
    const expireAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
    this.kv.set(key, { value, expireAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    this.checkProductionWarning();
    const existed = this.kv.delete(key) || this.zsets.delete(key);
    return existed ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.checkProductionWarning();
    const entry = this.kv.get(key);
    if (entry) {
      entry.expireAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async zadd(key: string, memberOrOpts: { score: number; member: string } | { score: number; member: string }[]): Promise<number> {
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
}

export interface IRedisClient {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  zadd(key: string, memberOrOpts: { score: number; member: string }): Promise<number>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zrange(key: string, min: number | string, max: number | string, opts?: { rev?: boolean }): Promise<string[]>;
}

export const redis: IRedisClient = isUpstashConfigured
  ? (new Redis({ url: url!, token: token! }) as unknown as IRedisClient)
  : new MemoryRedisStore();
