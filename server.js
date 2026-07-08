require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb, query, queryOne, execute, logOperation, saveDb, DATA_DIR } = require('./lib/db');
const { upload, computeHash } = require('./lib/image');
const { createToken, verifyToken, adminOnly, canEdit, canUpload, authLimiter, apiWriteLimiter } = require('./lib/auth');
const registerRoutes = require('./routes/api');

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false, lastModified: false }));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));
app.use(express.json());

app.use('/api/auth', authLimiter);
app.post('/api/mutations', apiWriteLimiter);
app.put('/api/mutations/:id', apiWriteLimiter);
app.delete('/api/mutations/:id', apiWriteLimiter);

registerRoutes(app, {
  query, queryOne, execute, logOperation, DATA_DIR,
  upload, computeHash,
  adminOnly, canEdit, canUpload, createToken, verifyToken
});

const multer = require('multer');
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '文件大小不能超过10MB' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

process.on('SIGTERM', () => { saveDb(); process.exit(0); });
process.on('SIGINT', () => { saveDb(); process.exit(0); });

initDb().then(async () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('花牛苹果芽变信息数据库已启动: http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('启动失败:', err);
});
