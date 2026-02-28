"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminConfig_1 = require("../lib/adminConfig");
const modelConfig_1 = require("../lib/modelConfig");
const storage_1 = require("../lib/storage");
const orders_1 = require("../lib/orders");
const audit_1 = require("../lib/audit");
const riskControl_1 = require("../lib/riskControl");
const accounts_1 = require("../lib/accounts");
const modelMetrics_1 = require("../lib/modelMetrics");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ALLOW_PERSIST_MODEL_API_KEY = process.env.ALLOW_PERSIST_MODEL_API_KEY === 'true';
const adminSensitiveLimiter = (0, riskControl_1.createRateLimiter)({
    keyPrefix: 'admin_sensitive',
    windowMs: 60 * 1000,
    max: 60,
    keyResolver: (req) => {
        const scope = req.adminScope;
        if (scope?.kind === 'enterprise')
            return `ent:${scope.enterpriseId}:${scope.userId}`;
        return `platform:${req.ip}`;
    },
    message: 'too many sensitive admin operations, please retry later'
});
const INVOICE_REJECT_REASONS = [
    { code: 'company_info_invalid', label: '企业信息不完整或不匹配' },
    { code: 'taxpayer_info_invalid', label: '纳税人识别信息有误' },
    { code: 'duplicate_request', label: '重复开票申请' },
    { code: 'unsupported_scope', label: '不在可开票范围' },
    { code: 'other', label: '其他' }
];
function csvEscape(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
function applyScopeToOrders(scope, orders) {
    if (scope.kind === 'platform')
        return orders;
    return orders.filter(o => o.enterpriseId === scope.enterpriseId);
}
function applyScopeToEnterprises(scope, enterprises) {
    if (scope.kind === 'platform')
        return enterprises;
    return enterprises.filter(e => e.id === scope.enterpriseId);
}
function adminAuth(req, res, next) {
    const auth = req.headers['x-admin-token'];
    if (auth === ADMIN_SECRET) {
        req.adminScope = { kind: 'platform' };
        return next();
    }
    const authHeader = req.headers.authorization;
    const enterpriseId = String(req.headers['x-enterprise-id'] || '');
    if (authHeader && enterpriseId) {
        const parts = authHeader.split(' ');
        if (parts.length === 2) {
            try {
                const payload = jsonwebtoken_1.default.verify(parts[1], JWT_SECRET);
                const account = (0, accounts_1.loadAccounts)().find(item => item.id === payload.sub);
                if (account?.disabled)
                    return res.status(403).json({ error: 'account disabled' });
                const enterprises = (0, storage_1.loadEnterprises)();
                const ent = enterprises.find(e => e.id === enterpriseId);
                if (!ent)
                    return res.status(404).json({ error: 'enterprise not found' });
                if (!(0, storage_1.canManageEnterprise)(ent, payload.sub))
                    return res.status(403).json({ error: 'enterprise admin required' });
                req.adminScope = { kind: 'enterprise', enterpriseId, userId: payload.sub };
                return next();
            }
            catch (e) {
            }
        }
    }
    res.status(403).json({ error: 'forbidden' });
}
function requirePlatformAdmin(req, res, next) {
    const scope = req.adminScope;
    if (scope?.kind !== 'platform')
        return res.status(403).json({ error: 'platform admin only' });
    next();
}
function writeAdminAudit(req, payload) {
    const scope = req.adminScope;
    (0, audit_1.appendAuditLog)({
        category: 'admin',
        action: payload.action,
        success: payload.success,
        actorType: scope?.kind === 'platform' ? 'platform_admin' : 'enterprise_admin',
        actorId: scope?.kind === 'platform' ? 'platform' : (scope?.userId || 'unknown'),
        enterpriseId: scope?.kind === 'enterprise' ? scope.enterpriseId : undefined,
        targetId: payload.targetId,
        message: payload.message,
        metadata: payload.metadata,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] || '')
    });
}
function maskSecret(secret) {
    const text = String(secret || '');
    if (!text)
        return '';
    if (text.length <= 6)
        return '***';
    return `${text.slice(0, 3)}***${text.slice(-3)}`;
}
function sanitizeConfigForRead(cfg) {
    const copy = JSON.parse(JSON.stringify(cfg || {}));
    if (copy?.model?.apiKey) {
        copy.model.apiKey = maskSecret(copy.model.apiKey);
        copy.model.apiKeyMasked = true;
    }
    if (Array.isArray(copy?.model?.selectableModels)) {
        copy.model.selectableModels = copy.model.selectableModels.map((item) => {
            const next = { ...(item || {}) };
            if (next.apiKey) {
                next.apiKey = maskSecret(next.apiKey);
                next.apiKeyMasked = true;
            }
            return next;
        });
    }
    return copy;
}
router.get('/config', adminAuth, requirePlatformAdmin, (req, res) => {
    res.json(sanitizeConfigForRead((0, adminConfig_1.loadAdminConfig)()));
});
router.get('/model/providers', adminAuth, requirePlatformAdmin, (req, res) => {
    res.json(modelConfig_1.MODEL_PROVIDER_TEMPLATES);
});
router.get('/dashboard', adminAuth, (req, res) => {
    const scope = req.adminScope;
    const enterprises = applyScopeToEnterprises(scope, (0, storage_1.loadEnterprises)());
    const orders = applyScopeToOrders(scope, (0, orders_1.loadOrders)());
    const invoicePending = orders.filter(o => o.invoiceStatus === 'pending').length;
    const result = {
        scope: scope.kind,
        enterpriseId: scope.kind === 'enterprise' ? scope.enterpriseId : undefined,
        enterpriseCount: enterprises.length,
        memberCount: enterprises.reduce((sum, item) => sum + (item.members?.length || 0), 0),
        orderCount: orders.length,
        invoicePending
    };
    if (scope.kind === 'platform') {
        result.modelMetrics = (0, modelMetrics_1.getModelMetricsSummary)();
    }
    res.json(result);
});
router.get('/model/metrics', adminAuth, requirePlatformAdmin, (req, res) => {
    res.json((0, modelMetrics_1.getModelMetricsSummary)());
});
router.get('/enterprises', adminAuth, (req, res) => {
    const scope = req.adminScope;
    const list = applyScopeToEnterprises(scope, (0, storage_1.loadEnterprises)()).map(item => ({
        ...item,
        memberCount: item.members?.length || 0
    }));
    res.json(list);
});
router.get('/users', adminAuth, requirePlatformAdmin, (req, res) => {
    const list = (0, accounts_1.loadAccounts)().map(item => ({
        id: item.id,
        disabled: Boolean(item.disabled),
        disabledReason: item.disabledReason || '',
        disabledAt: item.disabledAt,
        createdAt: item.createdAt,
        lastLoginAt: item.lastLoginAt
    }));
    res.json(list);
});
router.post('/users/disable', adminAuth, requirePlatformAdmin, adminSensitiveLimiter, (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!userId)
        return res.status(400).json({ error: 'missing userId' });
    const account = (0, accounts_1.setAccountDisabled)(userId, true, reason);
    writeAdminAudit(req, {
        action: 'users.disable',
        success: true,
        targetId: userId,
        metadata: { reason }
    });
    res.json({ success: true, user: account });
});
router.post('/users/enable', adminAuth, requirePlatformAdmin, adminSensitiveLimiter, (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    if (!userId)
        return res.status(400).json({ error: 'missing userId' });
    const account = (0, accounts_1.setAccountDisabled)(userId, false);
    writeAdminAudit(req, {
        action: 'users.enable',
        success: true,
        targetId: userId
    });
    res.json({ success: true, user: account });
});
router.get('/orders', adminAuth, (req, res) => {
    const scope = req.adminScope;
    let list = applyScopeToOrders(scope, (0, orders_1.loadOrders)());
    if (scope.kind === 'platform') {
        const enterpriseId = String(req.query.enterpriseId || '').trim();
        if (enterpriseId) {
            list = list.filter(item => item.enterpriseId === enterpriseId);
        }
    }
    const invoiceType = String(req.query.invoiceType || '').trim();
    if (invoiceType) {
        list = list.filter(item => item.invoiceType === invoiceType);
    }
    const invoiceStatus = String(req.query.invoiceStatus || '').trim();
    if (invoiceStatus) {
        list = list.filter(item => item.invoiceStatus === invoiceStatus);
    }
    res.json(list);
});
router.get('/orders/invoice/reject-reasons', adminAuth, requirePlatformAdmin, (req, res) => {
    res.json(INVOICE_REJECT_REASONS);
});
router.get('/orders/invoice/ledger/export', adminAuth, requirePlatformAdmin, (req, res) => {
    const scope = req.adminScope;
    let list = applyScopeToOrders(scope, (0, orders_1.loadOrders)());
    const enterpriseId = String(req.query.enterpriseId || '').trim();
    if (enterpriseId) {
        list = list.filter(item => item.enterpriseId === enterpriseId);
    }
    const invoiceType = String(req.query.invoiceType || '').trim();
    if (invoiceType) {
        list = list.filter(item => item.invoiceType === invoiceType);
    }
    const invoiceStatus = String(req.query.invoiceStatus || '').trim();
    if (invoiceStatus) {
        list = list.filter(item => item.invoiceStatus === invoiceStatus);
    }
    const headers = [
        'orderId',
        'enterpriseId',
        'userId',
        'amount',
        'createdAt',
        'invoiceType',
        'invoiceStatus',
        'invoiceReviewedAt',
        'invoiceReviewedBy',
        'invoiceRejectCode',
        'invoiceRejectRemark'
    ];
    const rows = list.map((item) => [
        csvEscape(item.id),
        csvEscape(item.enterpriseId),
        csvEscape(item.userId),
        csvEscape(item.amount),
        csvEscape(item.createdAt),
        csvEscape(item.invoiceType),
        csvEscape(item.invoiceStatus),
        csvEscape(item.invoiceReviewedAt),
        csvEscape(item.invoiceReviewedBy),
        csvEscape(item.invoiceRejectCode),
        csvEscape(item.invoiceRejectRemark)
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `invoice-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${csv}`);
});
router.get('/audit-logs', adminAuth, requirePlatformAdmin, (req, res) => {
    const category = String(req.query.category || '').trim();
    const action = String(req.query.action || '').trim();
    const successText = String(req.query.success || '').trim().toLowerCase();
    const success = successText === '' ? null : successText === 'true';
    const limitRaw = Number(req.query.limit || 100);
    const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 100));
    let list = (0, audit_1.loadAuditLogs)();
    if (category)
        list = list.filter(item => item.category === category);
    if (action)
        list = list.filter(item => item.action === action);
    if (success !== null)
        list = list.filter(item => item.success === success);
    const data = list.slice(Math.max(0, list.length - limit)).reverse();
    res.json({ total: list.length, limit, policy: (0, audit_1.getAuditRetentionPolicy)(), data });
});
router.post('/orders/invoice/review', adminAuth, requirePlatformAdmin, adminSensitiveLimiter, (req, res) => {
    const { orderId, status } = req.body || {};
    const rejectCode = String(req.body?.rejectCode || '').trim();
    const rejectRemark = String(req.body?.rejectRemark || '').trim();
    if (!orderId)
        return res.status(400).json({ error: 'missing orderId' });
    if (!status || !['approved', 'rejected'].includes(status))
        return res.status(400).json({ error: 'invalid status' });
    if (status === 'rejected') {
        const valid = INVOICE_REJECT_REASONS.some(item => item.code === rejectCode);
        if (!valid)
            return res.status(400).json({ error: 'invalid rejectCode' });
        if (rejectCode === 'other' && !rejectRemark)
            return res.status(400).json({ error: 'rejectRemark required when rejectCode is other' });
    }
    const list = (0, orders_1.loadOrders)();
    const order = list.find(o => o.id === orderId);
    if (!order)
        return res.status(404).json({ error: 'order not found' });
    if (!order.invoiceRequested)
        return res.status(400).json({ error: 'invoice not requested' });
    if (order.invoiceType !== 'special') {
        writeAdminAudit(req, {
            action: 'orders.invoice.review',
            success: false,
            message: 'only special invoice requires review',
            targetId: orderId,
            metadata: { status, invoiceType: order.invoiceType }
        });
        return res.status(400).json({ error: 'only special invoice requires review' });
    }
    if (order.invoiceStatus !== 'pending') {
        writeAdminAudit(req, {
            action: 'orders.invoice.review',
            success: false,
            message: 'invoice is not pending',
            targetId: orderId,
            metadata: { status, invoiceStatus: order.invoiceStatus }
        });
        return res.status(400).json({ error: 'invoice is not pending' });
    }
    order.invoiceStatus = status;
    order.invoiceReviewedAt = new Date().toISOString();
    order.invoiceReviewedBy = 'platform';
    if (status === 'rejected') {
        order.invoiceRejectCode = rejectCode;
        order.invoiceRejectRemark = rejectRemark || undefined;
    }
    else {
        order.invoiceRejectCode = undefined;
        order.invoiceRejectRemark = undefined;
    }
    (0, orders_1.saveOrders)(list);
    writeAdminAudit(req, {
        action: 'orders.invoice.review',
        success: true,
        targetId: orderId,
        metadata: {
            status,
            invoiceType: order.invoiceType,
            rejectCode: status === 'rejected' ? rejectCode : undefined,
            hasRejectRemark: status === 'rejected' ? Boolean(rejectRemark) : undefined
        }
    });
    res.json({ success: true, order });
});
router.post('/config', adminAuth, requirePlatformAdmin, adminSensitiveLimiter, (req, res) => {
    const cfg = (0, adminConfig_1.loadAdminConfig)();
    const input = req.body || {};
    if (input.model !== undefined) {
        const result = (0, modelConfig_1.validateModelConfig)(input.model);
        if (!result.valid) {
            writeAdminAudit(req, {
                action: 'admin.config.update',
                success: false,
                message: result.message || 'invalid model config',
                metadata: { hasModelConfig: true }
            });
            return res.status(400).json({ error: result.message || 'invalid model config' });
        }
        input.model = result.normalized;
        if (!ALLOW_PERSIST_MODEL_API_KEY && input.model?.apiKey) {
            delete input.model.apiKey;
        }
    }
    Object.assign(cfg, input);
    if (!ALLOW_PERSIST_MODEL_API_KEY && cfg?.model?.apiKey) {
        delete cfg.model.apiKey;
    }
    (0, adminConfig_1.saveAdminConfig)(cfg);
    writeAdminAudit(req, {
        action: 'admin.config.update',
        success: true,
        metadata: {
            keys: Object.keys(input || {}),
            persistModelApiKey: ALLOW_PERSIST_MODEL_API_KEY,
            inputHasApiKey: Boolean(input?.model?.apiKey)
        }
    });
    res.json({
        success: true,
        warning: !ALLOW_PERSIST_MODEL_API_KEY ? 'model apiKey is not persisted; use environment variables in production' : undefined,
        config: sanitizeConfigForRead(cfg)
    });
});
exports.default = router;
