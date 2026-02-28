import fs from 'fs';
import path from 'path';

export interface Order {
  id: string;
  userId: string;
  enterpriseId?: string;
  amount: number;
  createdAt: string;
  invoiceRequested: boolean;
  invoiceType?: 'normal' | 'special';
  invoiceInfo?: any;
  invoiceStatus?: 'pending' | 'approved' | 'rejected';
  invoiceReviewedAt?: string;
  invoiceReviewedBy?: string;
  invoiceRejectCode?: 'company_info_invalid' | 'taxpayer_info_invalid' | 'duplicate_request' | 'unsupported_scope' | 'other';
  invoiceRejectRemark?: string;
}

const DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DIR, 'orders.json');

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

export function loadOrders(): Order[] {
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

export function saveOrders(list: Order[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function generateOrderId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
