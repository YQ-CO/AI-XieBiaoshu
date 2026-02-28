"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModelTask = createModelTask;
exports.updateModelTask = updateModelTask;
exports.getModelTask = getModelTask;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const FILE = path_1.default.join(DATA_DIR, 'model_tasks.json');
const MAX_TASKS = 2000;
function ensure() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs_1.default.existsSync(FILE))
        fs_1.default.writeFileSync(FILE, JSON.stringify([]), 'utf8');
}
function loadAll() {
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
function saveAll(list) {
    ensure();
    const kept = list.length > MAX_TASKS ? list.slice(list.length - MAX_TASKS) : list;
    fs_1.default.writeFileSync(FILE, JSON.stringify(kept, null, 2), 'utf8');
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function createModelTask(input) {
    const list = loadAll();
    const now = new Date().toISOString();
    const task = {
        id: generateId(),
        userId: input.userId,
        docId: input.docId,
        modelChoice: input.modelChoice,
        promptLength: input.promptLength,
        status: 'queued',
        createdAt: now,
        updatedAt: now
    };
    list.push(task);
    saveAll(list);
    return task;
}
function updateModelTask(id, patch) {
    const list = loadAll();
    const task = list.find(item => item.id === id);
    if (!task)
        return null;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    saveAll(list);
    return task;
}
function getModelTask(id) {
    const list = loadAll();
    return list.find(item => item.id === id) || null;
}
