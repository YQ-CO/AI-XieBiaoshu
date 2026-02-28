"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAuditLogs = loadAuditLogs;
exports.saveAuditLogs = saveAuditLogs;
exports.appendAuditLog = appendAuditLog;
exports.getAuditRetentionPolicy = getAuditRetentionPolicy;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const AUDIT_FILE = path_1.default.join(DATA_DIR, 'audit_logs.json');
const MAX_LOGS = Number(process.env.AUDIT_MAX_LOGS || 5000);
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 180);
function ensureAuditFile() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs_1.default.existsSync(AUDIT_FILE)) {
        fs_1.default.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf8');
    }
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function applyRetention(list) {
    const now = Date.now();
    const ms = Math.max(1, RETENTION_DAYS) * 24 * 60 * 60 * 1000;
    const minTime = now - ms;
    const byTime = list.filter(item => {
        const ts = Date.parse(item.createdAt || '');
        if (!Number.isFinite(ts))
            return false;
        return ts >= minTime;
    });
    const max = Number.isFinite(MAX_LOGS) && MAX_LOGS > 0 ? MAX_LOGS : 5000;
    return byTime.length > max ? byTime.slice(byTime.length - max) : byTime;
}
function loadAuditLogs() {
    ensureAuditFile();
    try {
        const raw = fs_1.default.readFileSync(AUDIT_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data;
    }
    catch (e) {
        return [];
    }
}
function saveAuditLogs(list) {
    ensureAuditFile();
    fs_1.default.writeFileSync(AUDIT_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function appendAuditLog(item) {
    const list = applyRetention(loadAuditLogs());
    const next = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...item
    };
    list.push(next);
    const kept = applyRetention(list);
    saveAuditLogs(kept);
    return next;
}
function getAuditRetentionPolicy() {
    return {
        retentionDays: Math.max(1, RETENTION_DAYS),
        maxLogs: Number.isFinite(MAX_LOGS) && MAX_LOGS > 0 ? MAX_LOGS : 5000
    };
}
