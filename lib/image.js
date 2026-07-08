const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { DATA_DIR } = require('./db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(DATA_DIR, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (ok.includes(ext)) return cb(null, true);
    cb(new Error('仅支持 JPG/PNG/GIF/WebP/BMP 格式'));
  }
});

async function computeHash(imagePath) {
  try {
    const { data } = await sharp(imagePath)
      .grayscale()
      .resize(9, 9, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = row * 9 + col;
        bits += data[idx] > data[idx + 1] ? '1' : '0';
        bits += data[idx] > data[idx + 9] ? '1' : '0';
        bits += data[idx] > data[idx + 10] ? '1' : '0';
        bits += data[idx + 1] > data[idx + 9] ? '1' : '0';
      }
    }
    const hex = BigInt('0b' + bits).toString(16);
    return hex.padStart(64, '0');
  } catch (e) {
    return '';
  }
}

module.exports = { upload, computeHash };
