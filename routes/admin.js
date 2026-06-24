const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { authenticate, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Mail = require('../models/Mail');
const FriendRequest = require('../models/FriendRequest');
const router = express.Router();

// Configuración de multer para avatares de usuarios editados por admin
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const uploadAvatar = multer({ storage: avatarStorage });

// Obtener todos los usuarios (incluye los eliminados soft)
router.get('/users', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { includeDeleted = false } = req.query;
    let query = {};
    if (!includeDeleted) {
      query.deletedAt = { $exists: false };
    }
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Obtener usuario por ID
router.get('/users/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Crear usuario
router.post('/users', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role, storageLimit } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user',
      storageLimit: storageLimit || 10 * 1024 * 1024 * 1024
    });
    
    await user.save();
    res.json({ success: true, user: { ...user._doc, password: undefined } });
  } catch (error) {
    next(error);
  }
});

// Editar usuario completo
router.put('/users/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { username, email, role, storageLimit, isActive, bio } = req.body;
    
    const userToEdit = await User.findById(req.params.id);
    if (!userToEdit) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No se puede bajar de rango a sí mismo
    if (req.user._id.toString() === req.params.id && role && role !== userToEdit.role && role === 'user') {
      return res.status(403).json({ error: 'No puedes bajar de rango tu propia cuenta' });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (storageLimit !== undefined) updateData.storageLimit = storageLimit;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (bio !== undefined) updateData.bio = bio;
    
    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Resetear contraseña de usuario
router.put('/users/:id/reset-password', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña es requerida' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
});

// Cambiar avatar de usuario
router.put('/users/:id/avatar', authenticate, isAdmin, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { avatar: req.file.path }, 
      { new: true }
    ).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Banear usuario
router.put('/users/:id/ban', authenticate, isAdmin, async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { isBanned: true, bannedAt: Date.now() }, 
      { new: true }
    ).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Desbanear usuario
router.put('/users/:id/unban', authenticate, isAdmin, async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { isBanned: false, bannedAt: null }, 
      { new: true }
    ).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Soft delete usuario
router.delete('/users/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { deletedAt: Date.now() }, 
      { new: true }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Restaurar usuario (deshacer soft delete)
router.put('/users/:id/restore', authenticate, isAdmin, async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { deletedAt: null }, 
      { new: true }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Obtener estadísticas
router.get('/stats', authenticate, isAdmin, async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ deletedAt: { $exists: false } });
    const activeUsers = await User.countDocuments({ isActive: true, deletedAt: { $exists: false } });
    const bannedUsers = await User.countDocuments({ isBanned: true, deletedAt: { $exists: false } });
    const totalStorage = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$storageUsed' } } }
    ]);
    const totalMails = await Mail.countDocuments();
    
    res.json({
      totalUsers,
      activeUsers,
      bannedUsers,
      totalStorage: totalStorage[0]?.total || 0,
      totalMails
    });
  } catch (error) {
    next(error);
  }
});

// Obtener estado del servidor
router.get('/server-status', authenticate, isAdmin, async (req, res, next) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const osInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
    const loadAvg = os.loadavg();

    res.json({
      success: true,
      uptime: {
        seconds: Math.floor(uptime),
        minutes: Math.floor(uptime / 60),
        hours: Math.floor(uptime / 3600),
        days: Math.floor(uptime / 86400)
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      os: osInfo,
      loadAverage: loadAvg
    });
  } catch (error) {
    next(error);
  }
});

// Limpiar caché (en este caso, borrar archivos temporales, si existieran)
router.post('/clear-cache', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Limpiar uploads temporales (si hubiera), aquí un placeholder
    res.json({ success: true, message: 'Caché limpiada correctamente' });
  } catch (error) {
    next(error);
  }
});

// Obtener informe completo de usuario
router.get('/users/:id/report', authenticate, isAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const sentMails = await Mail.countDocuments({ sender: req.params.id });
    const receivedMails = await Mail.countDocuments({ receiver: req.params.id });
    const friendCount = await FriendRequest.countDocuments({
      $or: [{ sender: req.params.id }, { receiver: req.params.id }],
      status: 'accepted'
    });
    
    res.json({
      user,
      sentMails,
      receivedMails,
      friendCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
