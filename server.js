require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    category TEXT NOT NULL,
    price TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image') THEN
        ALTER TABLE products RENAME COLUMN image TO images;
      END IF;
    END $$;
  `).catch(() => {});
}
initDB().catch(err => {
  console.error('FATAL: No se pudo conectar a la base de datos');
  console.error(err);
  process.exit(1);
});

if (!process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD no está definido en .env');
  process.exit(1);
}
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, bcrypt.genSaltSync(10));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'benedicto-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' }
});

app.use(express.static(path.join(__dirname, 'benedicto-joyeria'), {
  dotfiles: 'ignore',
  index: false
}));

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'benedicto-joyeria', 'admin.html'));
});

const uploadsDir = path.join(__dirname, 'benedicto-joyeria', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
  if (bcrypt.compareSync(password, ADMIN_HASH)) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Products ───
app.get('/api/products', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(result.rows);
}));

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json(result.rows[0]);
}));

app.post('/api/products', requireAuth, asyncHandler(async (req, res) => {
  const { title, images, category, price, description } = req.body;
  if (!title || !category || !price) {
    return res.status(400).json({ error: 'Título, categoría y precio son requeridos' });
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const imagesJson = images && images.length > 0 ? JSON.stringify(images) : '[]';
  await pool.query(
    'INSERT INTO products (id, title, images, category, price, description) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, title, imagesJson, category, price, description || '']
  );
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  res.status(201).json(result.rows[0]);
}));

app.put('/api/products/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  const { title, images, category, price, description } = req.body;
  const imagesJson = images ? JSON.stringify(images) : existing.rows[0].images;
  await pool.query(
    'UPDATE products SET title = $1, images = $2, category = $3, price = $4, description = $5 WHERE id = $6',
    [
      title ?? existing.rows[0].title,
      imagesJson,
      category ?? existing.rows[0].category,
      price ?? existing.rows[0].price,
      description ?? existing.rows[0].description,
      req.params.id
    ]
  );
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
}));

app.delete('/api/products/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  let images = [];
  try { images = JSON.parse(existing.rows[0].images || '[]'); } catch {}
  images.forEach(img => {
    if (typeof img === 'string' && img.startsWith('/uploads/')) {
      const fp = path.join(uploadsDir, path.basename(img));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

// ─── Image upload ───
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ─── Gallery ───
app.get('/api/gallery', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM gallery ORDER BY created_at DESC');
  res.json(result.rows);
}));

app.post('/api/gallery', requireAuth, asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await pool.query('INSERT INTO gallery (id, url) VALUES ($1, $2)', [id, url]);
  const result = await pool.query('SELECT * FROM gallery WHERE id = $1', [id]);
  res.status(201).json(result.rows[0]);
}));

app.delete('/api/gallery/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await pool.query('SELECT * FROM gallery WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  const url = existing.rows[0].url;
  if (url.startsWith('/uploads/')) {
    const fp = path.join(uploadsDir, path.basename(url));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

// ─── Gallery upload (multiple) ───
app.post('/api/gallery/upload', requireAuth, upload.array('images', 20), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se subieron imágenes' });
  }
  const urls = [];
  for (const file of req.files) {
    const url = '/uploads/' + file.filename;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await pool.query('INSERT INTO gallery (id, url) VALUES ($1, $2)', [id, url]);
    urls.push({ id, url });
  }
  res.status(201).json(urls);
}));

// ─── Reviews ───
app.get('/api/reviews', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
  res.json(result.rows);
}));

app.post('/api/reviews', requireAuth, asyncHandler(async (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) {
    return res.status(400).json({ error: 'Nombre y comentario son requeridos' });
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await pool.query(
    'INSERT INTO reviews (id, name, rating, comment) VALUES ($1, $2, $3, $4)',
    [id, name, Math.min(5, Math.max(1, Number(rating) || 5)), comment]
  );
  const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
  res.status(201).json(result.rows[0]);
}));

app.delete('/api/reviews/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'benedicto-joyeria', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Benedicto corriendo en puerto ${PORT}`);
});
