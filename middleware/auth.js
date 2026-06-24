const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'idk-mail-super-secret-key-2025');
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive || user.isBanned || user.deletedAt) return res.status(401).json({ error: 'Usuario no válido' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No tienes permisos de administrador' });
  }
  next();
};

module.exports = { authenticate, isAdmin };
