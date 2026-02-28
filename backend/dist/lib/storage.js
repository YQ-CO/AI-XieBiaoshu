"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnterprises = loadEnterprises;
exports.getEnterpriseRole = getEnterpriseRole;
exports.canManageEnterprise = canManageEnterprise;
exports.saveEnterprises = saveEnterprises;
exports.generateId = generateId;
exports.generateInviteCode = generateInviteCode;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DIR = path_1.default.resolve(__dirname, '../../data');
const FILE = path_1.default.join(DIR, 'enterprises.json');
function ensureDir() {
    if (!fs_1.default.existsSync(DIR))
        fs_1.default.mkdirSync(DIR, { recursive: true });
}
function loadEnterprises() {
    ensureDir();
    if (!fs_1.default.existsSync(FILE)) {
        fs_1.default.writeFileSync(FILE, JSON.stringify([]), 'utf8');
    }
    try {
        const raw = fs_1.default.readFileSync(FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data.map((item) => {
            const members = Array.isArray(item.members) ? item.members : [];
            const ownerId = item.ownerId || members[0] || '';
            const memberRoles = item.memberRoles || {};
            for (const userId of members) {
                if (!memberRoles[userId]) {
                    memberRoles[userId] = userId === ownerId ? 'owner' : 'member';
                }
            }
            return {
                ...item,
                members,
                ownerId,
                memberRoles
            };
        });
    }
    catch (e) {
        return [];
    }
}
function getEnterpriseRole(ent, userId) {
    if (!ent.members.includes(userId))
        return null;
    if (ent.memberRoles?.[userId])
        return ent.memberRoles[userId];
    if (ent.ownerId === userId)
        return 'owner';
    return 'member';
}
function canManageEnterprise(ent, userId) {
    const role = getEnterpriseRole(ent, userId);
    return role === 'owner' || role === 'admin';
}
function saveEnterprises(list) {
    ensureDir();
    fs_1.default.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function generateInviteCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}
