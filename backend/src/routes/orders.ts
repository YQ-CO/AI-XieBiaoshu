import { Router } from 'express';
import { loadOrders, saveOrders, generateOrderId, Order } from '../lib/orders';
import { loadEnterprises } from '../lib/storage';
import { verifyActiveUserToken } from '../lib/userAuth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'missing authorization' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid authorization header' });
  const token = parts[1];
  try {
    const payload: any = verifyActiveUserToken(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if ((err as Error)?.message === 'account disabled') {
      return res.status(403).json({ error: 'account disabled' });
    }
    return res.status(401).json({ error: 'invalid token' });
  }
}

// create recharge order
router.post('/recharge', authMiddleware, (req: any, res) => {
  const { amount, enterpriseId } = req.body;
  if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'invalid amount' });

  if (enterpriseId) {
    const enterprises = loadEnterprises();
    const ent = enterprises.find(e => e.id === enterpriseId);
    if (!ent) return res.status(404).json({ error: 'enterprise not found' });
    if (!ent.members.includes(req.user.sub)) return res.status(403).json({ error: 'not a member of enterprise' });
  }

  const list = loadOrders();
  const order: Order = {
    id: generateOrderId(),
    userId: req.user.sub,
    enterpriseId,
    amount,
    createdAt: new Date().toISOString(),
    invoiceRequested: false,
  };
  list.push(order);
  saveOrders(list);
  res.json(order);
});

// list user's orders
router.get('/my', authMiddleware, (req: any, res) => {
  const list = loadOrders();
  const mine = list.filter(o => o.userId === req.user.sub);
  res.json(mine);
});

// request invoice
router.post('/invoice', authMiddleware, (req: any, res) => {
  const { orderId, type, info } = req.body;
  if (!orderId || !type || !['normal','special'].includes(type)) return res.status(400).json({ error: 'invalid params' });
  const list = loadOrders();
  const order = list.find(o => o.id === orderId && o.userId === req.user.sub);
  if (!order) return res.status(404).json({ error: 'order not found' });
  order.invoiceRequested = true;
  order.invoiceType = type;
  order.invoiceInfo = info || {};
  order.invoiceStatus = type === 'special' ? 'pending' : 'approved';
  saveOrders(list);
  res.json({ success: true, order });
});

export default router;