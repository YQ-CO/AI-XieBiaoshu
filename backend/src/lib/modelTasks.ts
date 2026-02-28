import fs from 'fs';
import path from 'path';

export type ModelTaskStatus = 'queued' | 'running' | 'success' | 'failed';

export interface ModelTaskItem {
  id: string;
  userId: string;
  docId?: string;
  modelChoice?: string;
  promptLength: number;
  status: ModelTaskStatus;
  text?: string;
  apiName?: string;
  mode?: string;
  error?: string;
  errorCode?: string;
  statusCode?: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DATA_DIR, 'model_tasks.json');
const MAX_TASKS = 2000;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]), 'utf8');
}

function loadAll(): ModelTaskItem[] {
  ensure();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveAll(list: ModelTaskItem[]) {
  ensure();
  const kept = list.length > MAX_TASKS ? list.slice(list.length - MAX_TASKS) : list;
  fs.writeFileSync(FILE, JSON.stringify(kept, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createModelTask(input: {
  userId: string;
  docId?: string;
  modelChoice?: string;
  promptLength: number;
}): ModelTaskItem {
  const list = loadAll();
  const now = new Date().toISOString();
  const task: ModelTaskItem = {
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

export function updateModelTask(id: string, patch: Partial<ModelTaskItem>) {
  const list = loadAll();
  const task = list.find(item => item.id === id);
  if (!task) return null;
  Object.assign(task, patch, { updatedAt: new Date().toISOString() });
  saveAll(list);
  return task;
}

export function getModelTask(id: string) {
  const list = loadAll();
  return list.find(item => item.id === id) || null;
}
