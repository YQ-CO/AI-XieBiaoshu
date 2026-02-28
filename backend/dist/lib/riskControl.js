"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
const store = new Map();
function now() {
    return Date.now();
}
function createRateLimiter(opts) {
    const message = opts.message || 'too many requests';
    return (req, res, next) => {
        const key = `${opts.keyPrefix}:${opts.keyResolver(req) || 'unknown'}`;
        const n = now();
        const bucket = store.get(key);
        if (!bucket || bucket.resetAt <= n) {
            store.set(key, { count: 1, resetAt: n + opts.windowMs });
            return next();
        }
        if (bucket.count >= opts.max) {
            const retryAfter = Math.ceil((bucket.resetAt - n) / 1000);
            res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
            return res.status(429).json({ error: message });
        }
        bucket.count += 1;
        store.set(key, bucket);
        return next();
    };
}
