import {LRUCache} from 'lru-cache';
import type {NextApiResponse} from 'next';

/**
 * Configuration options for rate limiting
 */
type Options = {
  /** Maximum number of unique tokens that can be tracked per interval. Defaults to 500 */
  uniqueTokenPerInterval?: number;
  /** Time window in milliseconds for rate limiting. Defaults to 60000 (1 minute) */
  interval?: number;
};

/**
 * Creates a rate limiter instance that tracks request counts using an LRU cache
 * @param options Configuration options for the rate limiter
 * @returns Rate limiter instance with check method
 */
export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60000,
  });

  return {
    /**
     * Checks if the current request should be rate limited
     * @param params Check parameters
     * @param params.res Optional NextApiResponse to set rate limit headers on
     * @param params.limit Maximum number of requests allowed per interval
     * @param params.token Unique identifier for the requester (e.g. IP address or user ID)
     * @returns Promise that resolves to true if under limit, false if rate limited
     */
    check: ({
      res,
      limit,
      token,
    }: {
      res?: NextApiResponse;
      limit: number;
      token: string;
    }) =>
      new Promise<boolean>((resolve, reject) => {
        const tokenCount = tokenCache.get(token) ?? 0;
        const currentUsage = tokenCount + 1;

        tokenCache.set(token, currentUsage);

        const isRateLimited = currentUsage >= limit;

        if (res) {
          res.setHeader('X-RateLimit-Limit', limit);
          res.setHeader(
            'X-RateLimit-Remaining',
            isRateLimited ? 0 : limit - currentUsage
          );
        }

        return resolve(isRateLimited);
      }),
  };
}
