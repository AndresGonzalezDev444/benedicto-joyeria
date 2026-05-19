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

// ─── Database ───
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      image TEXT DEFAULT '',
      category TEXT NOT NULL,
      price TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
initDB().catch(err => {
  console.error('FATAL: No se pudo conectar a la base de datos:', err.message);
  process.exit(1);
});

// ─── Admin password (from .env, no fallback) ───
if (!process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD no está definido en .env');
  process.exit(1);
}
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, bcrypt.genSaltSync(10));

// ─── Middleware ───
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

// ─── Rate limiter for login ───
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' }
});

// ─── Static files (admin.html behind auth) ───
app.use(express.static(path.join(__dirname, 'benedicto-joyeria'), {
  dotfiles: 'ignore',
  index: false
}));

app.get('/admin.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'benedicto-joyeria', 'admin.html'));
});

// ─── Image upload ───
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

// ─── Auth middleware ───
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ─── Auth routes ───
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

// ─── Async wrapper ───
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Product routes (public) ───
app.get('/api/products', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM products ORDER BY created_at DESC'
  );
  res.json(result.rows);
}));

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1', [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json(result.rows[0]);
}));

// ─── Product routes (admin only) ───
app.post('/api/products', requireAuth, asyncHandler(async (req, res) => {
  const { title, image, category, price, description } = req.body;
  if (!title || !category || !price) {
    return res.status(400).json({ error: 'Título, categoría y precio son requeridos' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await pool.query(
    'INSERT INTO products (id, title, image, category, price, description) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, title, image || '', category, price, description || '']
  );

  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  res.status(201).json(result.rows[0]);
}));

app.put('/api/products/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await pool.query(
    'SELECT * FROM products WHERE id = $1', [req.params.id]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  const { title, image, category, price, description } = req.body;
  await pool.query(
    'UPDATE products SET title = $1, image = $2, category = $3, price = $4, description = $5 WHERE id = $6',
    [
      title ?? existing.rows[0].title,
      image ?? existing.rows[0].image,
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
  const existing = await pool.query(
    'SELECT * FROM products WHERE id = $1', [req.params.id]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

  if (existing.rows[0].image && existing.rows[0].image.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(existing.rows[0].image));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

// ─── Image upload ───
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Serve index ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'benedicto-joyeria', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Benedicto corriendo en puerto ${PORT}`);
});
