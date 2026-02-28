import { Router } from 'express';
import { loadDocuments, saveDocuments, generateDocId, Document } from '../lib/documents';
import { loadEnterprises } from '../lib/storage';
import { verifyActiveUserToken } from '../lib/userAuth';
import { Document as WordDocument, Packer, Paragraph, TextRun } from 'docx';

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

// create new document draft
router.post('/create', authMiddleware, (req: any, res) => {
  const { name, type, enterpriseId } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'missing name or type' });

  if (enterpriseId) {
    const enterprises = loadEnterprises();
    const ent = enterprises.find(e => e.id === enterpriseId);
    if (!ent) return res.status(404).json({ error: 'enterprise not found' });
    if (!ent.members.includes(req.user.sub)) return res.status(403).json({ error: 'not a member of enterprise' });
  }

  const list = loadDocuments();
  const now = new Date().toISOString();
  const doc: Document = {
    id: generateDocId(),
    userId: req.user.sub,
    enterpriseId,
    name,
    type,
    status: 'draft',
    createdAt: now,
    updatedAt: now
  };
  list.push(doc);
  saveDocuments(list);
  res.json(doc);
});

// update document content or status
router.post('/update', authMiddleware, (req: any, res) => {
  const { id, content, status } = req.body;
  if (!id) return res.status(400).json({ error: 'missing id' });
  const list = loadDocuments();
  const doc = list.find(d => d.id === id && d.userId === req.user.sub);
  if (!doc) return res.status(404).json({ error: 'document not found' });

  if (content !== undefined) doc.content = content;
  if (status && (status === 'draft' || status === 'submitted' || status === 'completed')) doc.status = status;
  doc.updatedAt = new Date().toISOString();
  saveDocuments(list);
  res.json(doc);
});

// submit document for review
router.post('/submit', authMiddleware, (req: any, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'missing id' });
  const list = loadDocuments();
  const doc = list.find(d => d.id === id && d.userId === req.user.sub);
  if (!doc) return res.status(404).json({ error: 'document not found' });
  doc.status = 'submitted';
  doc.submittedAt = new Date().toISOString();
  doc.updatedAt = doc.submittedAt;
  saveDocuments(list);
  res.json(doc);
});

// list user's documents
router.get('/my', authMiddleware, (req: any, res) => {
  const list = loadDocuments();
  const mine = list.filter(d => d.userId === req.user.sub);
  res.json(mine);
});

// get one document detail
router.get('/detail', authMiddleware, (req: any, res) => {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'missing id' });
  const list = loadDocuments();
  const doc = list.find(d => d.id === id && d.userId === req.user.sub);
  if (!doc) return res.status(404).json({ error: 'document not found' });
  res.json(doc);
});

// export document as docx
router.get('/export/word', authMiddleware, async (req: any, res) => {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'missing id' });
  const list = loadDocuments();
  const doc = list.find(d => d.id === id && d.userId === req.user.sub);
  if (!doc) return res.status(404).json({ error: 'document not found' });

  const title = String(doc.name || '未命名文档');
  const content = String(doc.content || '');
  const lines = content.split(/\r?\n/);

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      spacing: { after: 240 }
    }),
    new Paragraph({
      children: [new TextRun(`导出时间：${new Date().toLocaleString('zh-CN')}`)],
      spacing: { after: 240 }
    })
  ];

  for (const line of lines) {
    children.push(
      new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 120 }
      })
    );
  }

  const word = new WordDocument({
    sections: [{ properties: {}, children }]
  });

  const buffer = await Packer.toBuffer(word);
  const fileName = `${title.replace(/[\\/:*?"<>|]/g, '_') || 'document'}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  return res.send(buffer);
});

export default router;