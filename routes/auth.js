const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'routeflow-secret-key-change-in-production';
const JWT_EXPIRES = '24h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  let user = await User.findOne({ email: String(email).toLowerCase().trim() }).lean();

  // Bootstrap a default admin user on first login attempt in a fresh DB.
  if (!user && String(email).toLowerCase().trim() === 'admin@routeflow.com') {
    const hashed = await bcrypt.hash(password, 10);
    const created = await User.create({
      name: 'Admin User',
      email: 'admin@routeflow.com',
      password: hashed,
      role: 'admin'
    });
    user = created.toObject();
  }

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const created = await User.create({ name, email: normalizedEmail, password: hashed, role: role || 'driver' });

  const user = { id: created._id.toString(), name: created.name, email: created.email, role: created.role };
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user });
});

// GET /api/auth/me - get current user from token
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email role').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
