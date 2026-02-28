import fs from 'fs';
import path from 'path';

type Snapshot = Record<string, string | null>;

const DATA_DIR = path.resolve(__dirname, '../../data');
const FILES = [
  'admin_config.json',
  'audit_logs.json',
  'documents.json',
  'orders.json',
  'users.json',
  'enterprises.json',
  'model_metrics.json',
  'model_tasks.json'
];

function resolveDataFile(name: string) {
  return path.join(DATA_DIR, name);
}

export function snapshotData(): Snapshot {
  const result: Snapshot = {};
  for (const file of FILES) {
    const target = resolveDataFile(file);
    result[file] = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  }
  return result;
}

export function restoreData(snapshot: Snapshot) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of FILES) {
    const target = resolveDataFile(file);
    const previous = snapshot[file];
    if (previous === null || previous === undefined) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } else {
      fs.writeFileSync(target, previous, 'utf8');
    }
  }
}

export function seedTestData(overrides?: {
  adminConfig?: any;
  enterprises?: any[];
  users?: any[];
  documents?: any[];
  orders?: any[];
  audits?: any[];
  metrics?: any;
  tasks?: any[];
}) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const adminConfig = overrides?.adminConfig || {
    model: {
      mode: 'mock',
      provider: 'mock',
      apiName: 'mock-model',
      prefix: 'mock:',
      suffix: ':ok',
      maxPromptLength: 4000,
      timeoutMs: 30000,
      maxTokens: 800,
      temperature: 0.7
    }
  };

  const enterprises = overrides?.enterprises || [
    {
      id: 'ent-test-1',
      name: '测试企业A',
      inviteCode: 'INV123',
      members: ['test_user'],
      ownerId: 'test_user',
      memberRoles: { test_user: 'owner' },
      createdAt: new Date().toISOString()
    }
  ];

  const users = overrides?.users || [];
  const documents = overrides?.documents || [];
  const orders = overrides?.orders || [];
  const audits = overrides?.audits || [];
  const metrics = overrides?.metrics || {
    total: 0,
    success: 0,
    failure: 0,
    totalDurationMs: 0,
    recent: []
  };
  const tasks = overrides?.tasks || [];

  fs.writeFileSync(resolveDataFile('admin_config.json'), JSON.stringify(adminConfig, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('enterprises.json'), JSON.stringify(enterprises, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('users.json'), JSON.stringify(users, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('documents.json'), JSON.stringify(documents, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('orders.json'), JSON.stringify(orders, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('audit_logs.json'), JSON.stringify(audits, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('model_metrics.json'), JSON.stringify(metrics, null, 2), 'utf8');
  fs.writeFileSync(resolveDataFile('model_tasks.json'), JSON.stringify(tasks, null, 2), 'utf8');
}
