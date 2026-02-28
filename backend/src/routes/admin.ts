import { Router } from 'express';
import { loadAdminConfig, saveAdminConfig } from '../lib/adminConfig';
import { MODEL_PROVIDER_TEMPLATES, validateModelConfig } from '../lib/modelConfig';
import { canManageEnterprise, loadEnterprises } from '../lib/storage';
import { loadOrders, saveOrders } from '../lib/orders';
import { appendAuditLog, getAuditRetentionPolicy, loadAuditLogs } from '../lib/audit';
import { createRateLimiter } from '../lib/riskControl';
import { loadAccounts, setAccountDisabled } from '../lib/accounts';
import { getModelMetricsSummary } from '../lib/modelMetrics';
import jwt from 'jsonwebtoken';

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ALLOW_PERSIST_MODEL_API_KEY = process.env.ALLOW_PERSIST_MODEL_API_KEY === 'true';

const adminSensitiveLimiter = createRateLimiter({
  keyPrefix: 'admin_sensitive',
  windowMs: 60 * 1000,
  max: 60,
  keyResolver: (req) => {
    const scope: AdminScope = req.adminScope;
    if (scope?.kind === 'enterprise') return `ent:${scope.enterpriseId}:${scope.userId}`;
    return `platform:${req.ip}`;
  },
  message: 'too many sensitive admin operations, please retry later'
});

type AdminScope =
  | { kind: 'platform' }
  | { kind: 'enterprise'; enterpriseId: string; userId: string };

const INVOICE_REJECT_REASONS = [
  { code: 'company_info_invalid', label: '企业信息不完整或不匹配' },
  { code: 'taxpayer_info_invalid', label: '纳税人识别信息有误' },
  { code: 'duplicate_request', label: '重复开票申请' },
  { code: 'unsupported_scope', label: '不在可开票范围' },
  { code: 'other', label: '其他' }
] as const;

type InvoiceRejectReasonCode = typeof INVOICE_REJECT_REASONS[number]['code'];

function csvEscape(value: any) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function applyScopeToOrders(scope: AdminScope, orders: any[]) {
  if (scope.kind === 'platform') return orders;
  return orders.filter(o => o.enterpriseId === scope.enterpriseId);
}

function applyScopeToEnterprises(scope: AdminScope, enterprises: any[]) {
  if (scope.kind === 'platform') return enterprises;
  return enterprises.filter(e => e.id === scope.enterpriseId);
}

function adminAuth(req: any, res: any, next: any) {
  const auth = req.headers['x-admin-token'];
  if (auth === ADMIN_SECRET) {
    req.adminScope = { kind: 'platform' } as AdminScope;
    return next();
  }

  const authHeader = req.headers.authorization;
  const enterpriseId = String(req.headers['x-enterprise-id'] || '');
  if (authHeader && enterpriseId) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      try {
        const payload: any = jwt.verify(parts[1], JWT_SECRET);
        const account = loadAccounts().find(item => item.id === payload.sub);
        if (account?.disabled) return res.status(403).json({ error: 'account disabled' });
        const enterprises = loadEnterprises();
        const ent = enterprises.find(e => e.id === enterpriseId);
        if (!ent) return res.status(404).json({ error: 'enterprise not found' });
        if (!canManageEnterprise(ent, payload.sub)) return res.status(403).json({ error: 'enterprise admin required' });
        req.adminScope = { kind: 'enterprise', enterpriseId, userId: payload.sub } as AdminScope;
        return next();
      } catch (e) {
      }
    }
  }

  res.status(403).json({ error: 'forbidden' });
}

function requirePlatformAdmin(req: any, res: any, next: any) {
  const scope: AdminScope = req.adminScope;
  if (scope?.kind !== 'platform') return res.status(403).json({ error: 'platform admin only' });
  next();
}

function writeAdminAudit(req: any, payload: {
  action: string;
  success: boolean;
  message?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}) {
  const scope: AdminScope = req.adminScope;
  appendAuditLog({
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

function maskSecret(secret: any) {
  const text = String(secret || '');
  if (!text) return '';
  if (text.length <= 6) return '***';
  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function sanitizeConfigForRead(cfg: any) {
  const copy = JSON.parse(JSON.stringify(cfg || {}));
  if (copy?.model?.apiKey) {
    copy.model.apiKey = maskSecret(copy.model.apiKey);
    copy.model.apiKeyMasked = true;
  }
  if (Array.isArray(copy?.model?.selectableModels)) {
    copy.model.selectableModels = copy.model.selectableModels.map((item: any) => {
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
  res.json(sanitizeConfigForRead(loadAdminConfig()));
});

router.get('/model/providers', adminAuth, requirePlatformAdmin, (req, res) => {
  res.json(MODEL_PROVIDER_TEMPLATES);
});

router.get('/dashboard', adminAuth, (req: any, res) => {
  const scope: AdminScope = req.adminScope;
  const enterprises = applyScopeToEnterprises(scope, loadEnterprises());
  const orders = applyScopeToOrders(scope, loadOrders());
  const invoicePending = orders.filter(o => o.invoiceStatus === 'pending').length;
  const result: any = {
    scope: scope.kind,
    enterpriseId: scope.kind === 'enterprise' ? scope.enterpriseId : undefined,
    enterpriseCount: enterprises.length,
    memberCount: enterprises.reduce((sum, item) => sum + (item.members?.length || 0), 0),
    orderCount: orders.length,
    invoicePending
  };
  if (scope.kind === 'platform') {
    result.modelMetrics = getModelMetricsSummary();
  }
  res.json(result);
});

router.get('/model/metrics', adminAuth, requirePlatformAdmin, (req, res) => {
  res.json(getModelMetricsSummary());
});

router.get('/enterprises', adminAuth, (req: any, res) => {
  const scope: AdminScope = req.adminScope;
  const list = applyScopeToEnterprises(scope, loadEnterprises()).map(item => ({
    ...item,
    memberCount: item.members?.length || 0
  }));
  res.json(list);
});

router.get('/users', adminAuth, requirePlatformAdmin, (req, res) => {
  const list = loadAccounts().map(item => ({
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
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  const account = setAccountDisabled(userId, true, reason);
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
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  const account = setAccountDisabled(userId, false);
  writeAdminAudit(req, {
    action: 'users.enable',
    success: true,
    targetId: userId
  });
  res.json({ success: true, user: account });
});

router.get('/orders', adminAuth, (req: any, res) => {
  const scope: AdminScope = req.adminScope;
  let list = applyScopeToOrders(scope, loadOrders());

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

router.get('/orders/invoice/ledger/export', adminAuth, requirePlatformAdmin, (req: any, res) => {
  const scope: AdminScope = req.adminScope;
  let list = applyScopeToOrders(scope, loadOrders());

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

  const rows = list.map((item: any) => [
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

  let list = loadAuditLogs();
  if (category) list = list.filter(item => item.category === category);
  if (action) list = list.filter(item => item.action === action);
  if (success !== null) list = list.filter(item => item.success === success);

  const data = list.slice(Math.max(0, list.length - limit)).reverse();
  res.json({ total: list.length, limit, policy: getAuditRetentionPolicy(), data });
});

router.post('/orders/invoice/review', adminAuth, requirePlatformAdmin, adminSensitiveLimiter, (req, res) => {
  const { orderId, status } = req.body || {};
  const rejectCode = String(req.body?.rejectCode || '').trim() as InvoiceRejectReasonCode;
  const rejectRemark = String(req.body?.rejectRemark || '').trim();
  if (!orderId) return res.status(400).json({ error: 'missing orderId' });
  if (!status || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  if (status === 'rejected') {
    const valid = INVOICE_REJECT_REASONS.some(item => item.code === rejectCode);
    if (!valid) return res.status(400).json({ error: 'invalid rejectCode' });
    if (rejectCode === 'other' && !rejectRemark) return res.status(400).json({ error: 'rejectRemark required when rejectCode is other' });
  }
  const list = loadOrders();
  const order = list.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'order not found' });
  if (!order.invoiceRequested) return res.status(400).json({ error: 'invoice not requested' });
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
  } else {
    order.invoiceRejectCode = undefined;
    order.invoiceRejectRemark = undefined;
  }
  saveOrders(list);
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
  const cfg = loadAdminConfig();
  const input = req.body || {};

  if (input.model !== undefined) {
    const result = validateModelConfig(input.model);
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
  saveAdminConfig(cfg);
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
    success:true,
    warning: !ALLOW_PERSIST_MODEL_API_KEY ? 'model apiKey is not persisted; use environment variables in production' : undefined,
    config: sanitizeConfigForRead(cfg)
  });
});

export default router;