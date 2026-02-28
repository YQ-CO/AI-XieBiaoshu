"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: path_1.default.resolve(__dirname, '../../data/uploads') });
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'no file' });
    const filePath = req.file.path;
    // mock parsing: read file name and return dummy structure
    const parsed = {
        fileName: req.file.originalname,
        sections: [
            { title: '基本信息', content: '这里是解析出的基本信息...' },
            { title: '资格要求', content: '这里是解析出的资格要求...' }
        ]
    };
    res.json(parsed);
});
exports.default = router;
