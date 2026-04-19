const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'routeflow-secret-key-change-in-production';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  requireAuth,
};