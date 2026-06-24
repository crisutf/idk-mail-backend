const express = require('express');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const blockedIds = currentUser.blockedUsers || [];
    
    const users = await User.find({ 
      _id: { $ne: req.user._id, $nin: blockedIds }, 
      isActive: true 
    }).select('-password -blockedUsers');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get('/blocked', authenticate, async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id).populate('blockedUsers', 'username email');
    res.json(currentUser.blockedUsers || []);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
