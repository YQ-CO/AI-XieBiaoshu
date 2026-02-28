"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordModelMetric = recordModelMetric;
exports.getModelMetricsSummary = getModelMetricsSummary;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const FILE = path_1.default.join(DATA_DIR, 'model_metrics.json');
const MAX_RECENT = 500;
function ensure() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs_1.default.existsSync(FILE)) {
        const initial = {
            total: 0,
            success: 0,
            failure: 0,
            totalDurationMs: 0,
            recent: []
        };
        fs_1.default.writeFileSync(FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
}
function loadStore() {
    ensure();
    try {
        const raw = fs_1.default.readFileSync(FILE, 'utf8');
        const data = JSON.parse(raw || '{}');
        return {
            total: Number(data.total || 0),
            success: Number(data.success || 0),
            failure: Number(data.failure || 0),
            totalDurationMs: Number(data.totalDurationMs || 0),
            recent: Array.isArray(data.recent) ? data.recent : []
        };
    }
    catch (e) {
        return {
            total: 0,
            success: 0,
            failure: 0,
            totalDurationMs: 0,
            recent: []
        };
    }
}
function saveStore(store) {
    ensure();
    fs_1.default.writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf8');
}
function recordModelMetric(item) {
    const store = loadStore();
    store.total += 1;
    if (item.success)
        store.success += 1;
    else
        store.failure += 1;
    store.totalDurationMs += Math.max(0, Math.round(item.durationMs || 0));
    store.recent.push({
        ts: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(item.durationMs || 0)),
        success: Boolean(item.success),
        mode: item.mode,
        apiName: item.apiName,
        errorCode: item.errorCode
    });
    if (store.recent.length > MAX_RECENT) {
        store.recent = store.recent.slice(store.recent.length - MAX_RECENT);
    }
    saveStore(store);
}
function getModelMetricsSummary() {
    const store = loadStore();
    const total = store.total;
    const successRate = total > 0 ? Number(((store.success / total) * 100).toFixed(2)) : 0;
    const avgLatencyMs = total > 0 ? Number((store.totalDurationMs / total).toFixed(2)) : 0;
    const recent = store.recent.slice(-100);
    const recentTotal = recent.length;
    const recentSuccess = recent.filter(item => item.success).length;
    const recentAvgLatencyMs = recentTotal
        ? Number((recent.reduce((sum, item) => sum + item.durationMs, 0) / recentTotal).toFixed(2))
        : 0;
    return {
        total,
        success: store.success,
        failure: store.failure,
        successRate,
        avgLatencyMs,
        recentWindow: recentTotal,
        recentSuccessRate: recentTotal ? Number(((recentSuccess / recentTotal) * 100).toFixed(2)) : 0,
        recentAvgLatencyMs,
        updatedAt: store.recent.length ? store.recent[store.recent.length - 1].ts : null
    };
}
