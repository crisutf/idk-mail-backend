const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

const DEFAULT_DOMAIN = 'idk.tf';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Error de validación', details: errors.array() });
  }
  next();
};

const processEmail = (email, isAdmin = false) => {
  if (isAdmin) {
    // Admins can use any domain
    if (!email.includes('@')) {
      return `${email}@${DEFAULT_DOMAIN}`;
    }
    return email;
  }
  
  // Normal users forced to use @idk.tf
  if (email.includes('@')) {
    const localPart = email.split('@')[0];
    return `${localPart}@${DEFAULT_DOMAIN}`;
  }
  
  return `${email}@${DEFAULT_DOMAIN}`;
};

router.post('/register', [
  body('username').trim().isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres'),
  body('email').notEmpty().withMessage('El email es requerido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
], validate, async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const ip = req.ip;
    
    // Process email to force @idk.tf for non-admins
    const processedEmail = processEmail(email, false);
    
    // Check existing user with processed email
    const existingUser = await User.findOne({ $or: [{ username }, { email: processedEmail }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      username,
      email: processedEmail,
      password: hashedPassword,
      ip,
      lastLogin: new Date()
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'idk-mail-super-secret-key-2025', 
      { expiresIn: '7d' }
    );
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit
      } 
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', [
  body('username').trim().notEmpty().withMessage('El nombre de usuario o email es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
], validate, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    user.lastLogin = new Date();
    user.ip = req.ip;
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'idk-mail-super-secret-key-2025', 
      { expiresIn: '7d' }
    );
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit
      } 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
