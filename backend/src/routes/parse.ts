import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const upload = multer({ dest: path.resolve(__dirname, '../../data/uploads') });

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const filePath = req.file.path;
  // mock parsing: read file name and return dummy structure
  const parsed = {
    fileName: req.file.originalname,
    sections: [
      { title: '基本信息', content: '这里是解析出的基本信息...'},
      { title: '资格要求', content: '这里是解析出的资格要求...'}
    ]
  };
  res.json(parsed);
});

export default router;