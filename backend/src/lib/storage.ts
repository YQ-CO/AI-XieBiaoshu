import fs from 'fs';
import path from 'path';

export interface Enterprise {
  id: string;
  name: string;
  creditCode?: string;
  mobile?: string;
  inviteCode: string;
  members: string[];
  ownerId?: string;
  memberRoles?: Record<string, 'owner' | 'admin' | 'member'>;
  createdAt: string;
}

const DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DIR, 'enterprises.json');

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

export function loadEnterprises(): Enterprise[] {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([]), 'utf8');
  }
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => {
      const members: string[] = Array.isArray(item.members) ? item.members : [];
      const ownerId = item.ownerId || members[0] || '';
      const memberRoles: Record<string, 'owner' | 'admin' | 'member'> = item.memberRoles || {};
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
  } catch (e) {
    return [];
  }
}

export function getEnterpriseRole(ent: Enterprise, userId: string): 'owner' | 'admin' | 'member' | null {
  if (!ent.members.includes(userId)) return null;
  if (ent.memberRoles?.[userId]) return ent.memberRoles[userId];
  if (ent.ownerId === userId) return 'owner';
  return 'member';
}

export function canManageEnterprise(ent: Enterprise, userId: string): boolean {
  const role = getEnterpriseRole(ent, userId);
  return role === 'owner' || role === 'admin';
}

export function saveEnterprises(list: Enterprise[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
