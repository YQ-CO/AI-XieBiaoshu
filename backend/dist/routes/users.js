"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_1 = require("../lib/storage");
const userAuth_1 = require("../lib/userAuth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'missing authorization' });
    const parts = authHeader.split(' ');
    if (parts.length !== 2)
        return res.status(401).json({ error: 'invalid authorization header' });
    const token = parts[1];
    try {
        const payload = (0, userAuth_1.verifyActiveUserToken)(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err?.message === 'account disabled') {
            return res.status(403).json({ error: 'account disabled' });
        }
        return res.status(401).json({ error: 'invalid token' });
    }
}
router.get('/me', authMiddleware, (req, res) => {
    const user = req.user;
    // 从企业数据中查找所属企业
    const all = (0, storage_1.loadEnterprises)();
    const myOrgs = all.filter(e => e.members.includes(user.sub)).map(e => ({ id: e.id, name: e.name, inviteCode: e.inviteCode, role: (0, storage_1.getEnterpriseRole)(e, user.sub) }));
    res.json({ id: user.sub, username: user.sub, mobile: user.sub, role: 'user', enterprises: myOrgs });
});
// 切换到某个企业（验证用户属于该企业）
router.post('/switch', authMiddleware, (req, res) => {
    const { enterpriseId } = req.body;
    if (!enterpriseId)
        return res.status(400).json({ error: 'missing enterpriseId' });
    const all = (0, storage_1.loadEnterprises)();
    const ent = all.find(e => e.id === enterpriseId);
    if (!ent)
        return res.status(404).json({ error: 'enterprise not found' });
    if (!ent.members.includes(req.user.sub))
        return res.status(403).json({ error: 'not a member' });
    // 返回企业信息，前端可保存 enterpriseId 作为当前上下文
    res.json({ success: true, enterprise: { id: ent.id, name: ent.name, creditCode: ent.creditCode, role: (0, storage_1.getEnterpriseRole)(ent, req.user.sub) } });
});
exports.default = router;
