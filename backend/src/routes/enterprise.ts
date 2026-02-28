import { Router } from 'express';
import { canManageEnterprise, getEnterpriseRole, loadEnterprises, saveEnterprises, generateId, generateInviteCode } from '../lib/storage';
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

// 创建企业（返回 inviteCode）
router.post('/create', authMiddleware, (req: any, res) => {
  const { name, creditCode, mobile } = req.body;
  if (!name) return res.status(400).json({ error: 'missing name' });
  const list = loadEnterprises();
  const id = generateId();
  const inviteCode = generateInviteCode();
  const ent = {
    id,
    name,
    creditCode: creditCode || '',
    mobile: mobile || '',
    inviteCode,
    members: [req.user.sub],
    ownerId: req.user.sub,
    memberRoles: { [req.user.sub]: 'owner' as const },
    createdAt: new Date().toISOString()
  };
  list.push(ent);
  saveEnterprises(list);
  res.json(ent);
});

// 通过邀请码加入企业
router.post('/join', authMiddleware, (req: any, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'missing inviteCode' });
  const list = loadEnterprises();
  const ent = list.find(e => e.inviteCode === inviteCode);
  if (!ent) return res.status(404).json({ error: 'invite code not found' });
  if (!ent.members.includes(req.user.sub)) ent.members.push(req.user.sub);
  if (!ent.memberRoles) ent.memberRoles = {};
  if (!ent.memberRoles[req.user.sub]) ent.memberRoles[req.user.sub] = 'member';
  saveEnterprises(list);
  res.json({ success: true, enterprise: ent, role: getEnterpriseRole(ent, req.user.sub) });
});

// 获取当前用户所属企业列表
router.get('/my', authMiddleware, (req: any, res) => {
  const list = loadEnterprises();
  const mine = list.filter(e => e.members.includes(req.user.sub)).map(e => ({
    ...e,
    myRole: getEnterpriseRole(e, req.user.sub)
  }));
  res.json(mine);
});

// get members and roles for one enterprise
router.get('/members', authMiddleware, (req: any, res) => {
  const enterpriseId = String(req.query.enterpriseId || '');
  if (!enterpriseId) return res.status(400).json({ error: 'missing enterpriseId' });
  const list = loadEnterprises();
  const ent = list.find(e => e.id === enterpriseId);
  if (!ent) return res.status(404).json({ error: 'enterprise not found' });
  if (!ent.members.includes(req.user.sub)) return res.status(403).json({ error: 'not a member' });
  const members = ent.members.map(userId => ({
    userId,
    role: getEnterpriseRole(ent, userId)
  }));
  res.json({ enterpriseId, members });
});

// owner/admin updates member role
router.post('/role/update', authMiddleware, (req: any, res) => {
  const { enterpriseId, userId, role } = req.body || {};
  if (!enterpriseId || !userId || !role) return res.status(400).json({ error: 'missing params' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const list = loadEnterprises();
  const ent = list.find(e => e.id === enterpriseId);
  if (!ent) return res.status(404).json({ error: 'enterprise not found' });
  if (!canManageEnterprise(ent, req.user.sub)) return res.status(403).json({ error: 'permission denied' });
  if (!ent.members.includes(userId)) return res.status(404).json({ error: 'member not found' });
  if (ent.ownerId === userId) return res.status(400).json({ error: 'cannot change owner role' });
  if (!ent.memberRoles) ent.memberRoles = {};
  ent.memberRoles[userId] = role;
  saveEnterprises(list);
  res.json({ success: true, enterpriseId, userId, role });
});

export default router;
