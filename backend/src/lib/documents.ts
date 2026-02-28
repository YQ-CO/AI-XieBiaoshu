import fs from 'fs';
import path from 'path';

export interface Document {
  id: string;
  userId: string;
  enterpriseId?: string;
  name: string;
  type: 'scoring' | 'directory' | 'special';
  fileCount?: number;
  wordCount?: number;
  status: 'draft' | 'submitted' | 'completed';
  content?: any;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DIR, 'documents.json');

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

export function loadDocuments(): Document[] {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([]), 'utf8');
  }
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export function saveDocuments(list: Document[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function generateDocId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
