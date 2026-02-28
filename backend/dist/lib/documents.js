"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDocuments = loadDocuments;
exports.saveDocuments = saveDocuments;
exports.generateDocId = generateDocId;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DIR = path_1.default.resolve(__dirname, '../../data');
const FILE = path_1.default.join(DIR, 'documents.json');
function ensureDir() {
    if (!fs_1.default.existsSync(DIR))
        fs_1.default.mkdirSync(DIR, { recursive: true });
}
function loadDocuments() {
    ensureDir();
    if (!fs_1.default.existsSync(FILE)) {
        fs_1.default.writeFileSync(FILE, JSON.stringify([]), 'utf8');
    }
    try {
        const raw = fs_1.default.readFileSync(FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch (e) {
        return [];
    }
}
function saveDocuments(list) {
    ensureDir();
    fs_1.default.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}
function generateDocId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
