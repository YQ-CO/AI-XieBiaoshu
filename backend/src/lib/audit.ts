import fs from 'fs';
import path from 'path';

export type AuditActorType = 'user' | 'platform_admin' | 'enterprise_admin' | 'system';

export interface AuditLogItem {
  id: string;
  category: 'model' | 'admin';
  action: string;
  success: boolean;
  actorType: AuditActorType;
  actorId: string;
  enterpriseId?: string;
  targetId?: string;
  message?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');
const MAX_LOGS = Number(process.env.AUDIT_MAX_LOGS || 5000);
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 180);

function ensureAuditFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function applyRetention(list: AuditLogItem[]) {
  const now = Date.now();
  const ms = Math.max(1, RETENTION_DAYS) * 24 * 60 * 60 * 1000;
  const minTime = now - ms;
  const byTime = list.filter(item => {
    const ts = Date.parse(item.createdAt || '');
    if (!Number.isFinite(ts)) return false;
    return ts >= minTime;
  });
  const max = Number.isFinite(MAX_LOGS) && MAX_LOGS > 0 ? MAX_LOGS : 5000;
  return byTime.length > max ? byTime.slice(byTime.length - max) : byTime;
}

export function loadAuditLogs(): AuditLogItem[] {
  ensureAuditFile();
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as AuditLogItem[];
  } catch (e) {
    return [];
  }
}

export function saveAuditLogs(list: AuditLogItem[]) {
  ensureAuditFile();
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function appendAuditLog(item: Omit<AuditLogItem, 'id' | 'createdAt'>): AuditLogItem {
  const list = applyRetention(loadAuditLogs());
  const next: AuditLogItem = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...item
  };
  list.push(next);
  const kept = applyRetention(list);
  saveAuditLogs(kept);
  return next;
}

export function getAuditRetentionPolicy() {
  return {
    retentionDays: Math.max(1, RETENTION_DAYS),
    maxLogs: Number.isFinite(MAX_LOGS) && MAX_LOGS > 0 ? MAX_LOGS : 5000
  };
}
