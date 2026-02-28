"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const riskControl_1 = require("../lib/riskControl");
const accounts_1 = require("../lib/accounts");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const loginLimiter = (0, riskControl_1.createRateLimiter)({
    keyPrefix: 'auth_login',
    windowMs: 60 * 1000,
    max: 20,
    keyResolver: (req) => `${req.ip}:${String(req.body?.username || req.body?.mobile || '')}`,
    message: 'too many login attempts, please retry later'
});
// 简化示例：手机号+验证码登录 或 用户名+密码登录
router.post('/login', loginLimiter, (req, res) => {
    const { type, mobile, password, code, username } = req.body;
    // 这里示例使用非常简化的校验，真实项目请接入短信服务和数据库验证
    if (type === 'sms') {
        if (!mobile || !code)
            return res.status(400).json({ error: 'missing mobile or code' });
        (0, accounts_1.ensureAccount)(mobile);
        if ((0, accounts_1.isAccountDisabled)(mobile))
            return res.status(403).json({ error: 'account disabled' });
        // mock 登录成功
        const token = jsonwebtoken_1.default.sign({ sub: mobile, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        (0, accounts_1.touchLastLogin)(mobile);
        return res.json({ token, expiresIn: 7 * 24 * 3600 });
    }
    if (type === 'password') {
        if (!username || !password)
            return res.status(400).json({ error: 'missing username or password' });
        (0, accounts_1.ensureAccount)(username);
        if ((0, accounts_1.isAccountDisabled)(username))
            return res.status(403).json({ error: 'account disabled' });
        // mock 登录成功
        const token = jsonwebtoken_1.default.sign({ sub: username, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        (0, accounts_1.touchLastLogin)(username);
        return res.json({ token, expiresIn: 7 * 24 * 3600 });
    }
    return res.status(400).json({ error: 'unsupported login type' });
});
exports.default = router;
