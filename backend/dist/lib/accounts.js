"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAccounts = loadAccounts;
exports.saveAccounts = saveAccounts;
exports.ensureAccount = ensureAccount;
exports.touchLastLogin = touchLastLogin;
exports.isAccountDisabled = isAccountDisabled;
exports.setAccountDisabled = setAccountDisabled;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DIR = path_1.default.resolve(__dirname, '../../data');
const FILE = path_1.default.join(DIR, 'users.json');
function ensure() {
    if (!fs_1.default.existsSync(DIR))
        fs_1.default.mkdirSync(DIR, { recursive: true });
    if (!fs_1.default.existsSync(FILE))
        fs_1.default.writeFileSync(FILE, JSON.stringify([]), 'utf8');
}
function loadAccounts() {
    ensure();
    try {
        const raw = fs_1.default.readFileSync(FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch (e) {
        return [];
    }
}
function saveAccounts(list) {
    ensure();
    fs_1.default.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}
function ensureAccount(userId) {
    const list = loadAccounts();
    let hit = list.find(item => item.id === userId);
    if (!hit) {
        hit = {
            id: userId,
            disabled: false,
            createdAt: new Date().toISOString()
        };
        list.push(hit);
        saveAccounts(list);
    }
    return hit;
}
function touchLastLogin(userId) {
    const list = loadAccounts();
    let hit = list.find(item => item.id === userId);
    if (!hit) {
        hit = {
            id: userId,
            disabled: false,
            createdAt: new Date().toISOString()
        };
        list.push(hit);
    }
    hit.lastLoginAt = new Date().toISOString();
    saveAccounts(list);
}
function isAccountDisabled(userId) {
    const hit = ensureAccount(userId);
    return Boolean(hit.disabled);
}
function setAccountDisabled(userId, disabled, reason) {
    const list = loadAccounts();
    let hit = list.find(item => item.id === userId);
    if (!hit) {
        hit = {
            id: userId,
            disabled: false,
            createdAt: new Date().toISOString()
        };
        list.push(hit);
    }
    hit.disabled = disabled;
    if (disabled) {
        hit.disabledAt = new Date().toISOString();
        hit.disabledReason = reason || '';
    }
    else {
        hit.disabledAt = undefined;
        hit.disabledReason = undefined;
    }
    saveAccounts(list);
    return hit;
}
