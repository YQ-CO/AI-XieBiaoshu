import fs from 'fs';
import path from 'path';

export interface AccountRecord {
  id: string;
  disabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

const DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DIR, 'users.json');

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]), 'utf8');
}

export function loadAccounts(): AccountRecord[] {
  ensure();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export function saveAccounts(list: AccountRecord[]) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function ensureAccount(userId: string): AccountRecord {
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

export function touchLastLogin(userId: string) {
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

export function isAccountDisabled(userId: string): boolean {
  const hit = ensureAccount(userId);
  return Boolean(hit.disabled);
}

export function setAccountDisabled(userId: string, disabled: boolean, reason?: string) {
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
  } else {
    hit.disabledAt = undefined;
    hit.disabledReason = undefined;
  }
  saveAccounts(list);
  return hit;
}
