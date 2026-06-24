const express = require('express');
const { authenticate } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const router = express.Router();

router.post('/requests', authenticate, async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    const existing = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ],
      status: 'pending'
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una solicitud pendiente' });
    }
    
    const request = new FriendRequest({
      sender: req.user._id,
      receiver: receiverId
    });
    await request.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', authenticate, async (req, res, next) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'username email');
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.put('/requests/:id', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    await FriendRequest.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const requests = await FriendRequest.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ],
      status: 'accepted'
    }).populate('sender', 'username email').populate('receiver', 'username email');
    
    const friends = requests.map(request => 
      request.sender._id.toString() === req.user._id.toString() ? request.receiver : request.sender
    );
    
    res.json(friends);
  } catch (error) {
    next(error);
  }
});

router.delete('/:friendId', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    
    await FriendRequest.deleteOne({
      $or: [
        { sender: req.user._id, receiver: friendId, status: 'accepted' },
        { sender: friendId, receiver: req.user._id, status: 'accepted' }
      ]
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/block/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: userId }
    });
    
    await FriendRequest.deleteOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/block/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: userId }
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
