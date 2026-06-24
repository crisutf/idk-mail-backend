const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

const DEFAULT_DOMAIN = 'idk.tf';

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.get('/', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.username) updateData.username = req.body.username;
    if (req.body.email) {
      updateData.email = processEmail(req.body.email, req.user.role === 'admin');
    }
    if (req.body.bio !== undefined) updateData.bio = req.body.bio;
    if (req.file) {
      updateData.avatar = req.file.path;
    }
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 12);
    }
    
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
