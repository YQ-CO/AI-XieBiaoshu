import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../../src/lib/riskControl';

describe('riskControl.createRateLimiter', () => {
  it('blocks requests when limit is reached', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'test_limit',
      windowMs: 60_000,
      max: 2,
      keyResolver: (req) => String(req.ip || 'unknown'),
      message: 'limited'
    });

    const req = { ip: '127.0.0.1' };
    const next = vi.fn();
    const res = {
      headers: {} as Record<string, string>,
      statusCode: 200,
      payload: null as any,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.payload = payload;
        return this;
      }
    };

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.payload).toEqual({ error: 'limited' });
    expect(Number(res.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });
});
