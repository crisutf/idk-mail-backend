const express = require('express');
const { authenticate } = require('../middleware/auth');
const PrivateMessage = require('../models/PrivateMessage');
const PublicMessage = require('../models/PublicMessage');
const router = express.Router();

router.get('/private/:friendId', authenticate, async (req, res, next) => {
  try {
    const messages = await PrivateMessage.find({
      $or: [
        { sender: req.user._id, receiver: req.params.friendId },
        { sender: req.params.friendId, receiver: req.user._id }
      ]
    })
    .populate('sender', 'username')
    .populate('receiver', 'username')
    .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.get('/public', authenticate, async (req, res, next) => {
  try {
    const messages = await PublicMessage.find()
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(messages.reverse());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
