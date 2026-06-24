const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const Mail = require('../models/Mail');
const User = require('../models/User');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

router.post('/', authenticate, upload.array('attachments', 10), async (req, res, next) => {
  try {
    const { receiver, subject, body } = req.body;
    let receiverUser;
    
    if (receiver.includes('@')) {
      receiverUser = await User.findOne({ email: receiver });
    } else {
      receiverUser = await User.findOne({ username: receiver });
    }
    
    if (!receiverUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const attachments = req.files?.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size
    })) || [];
    
    const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
    
    if (req.user.storageUsed + totalSize > req.user.storageLimit) {
      return res.status(400).json({ error: 'Límite de almacenamiento excedido' });
    }
    
    const mail = new Mail({
      sender: req.user._id,
      receiver: receiverUser._id,
      subject,
      body,
      attachments
    });
    
    await mail.save();
    
    req.user.storageUsed += totalSize;
    await req.user.save();
    
    res.json({ success: true, mail });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const mails = await Mail.find({
      $and: [
        { $or: [{ sender: req.user._id }, { receiver: req.user._id }] },
        { deletedBy: { $ne: req.user._id } }
      ]
    })
    .populate('sender', 'username email')
    .populate('receiver', 'username email')
    .sort({ createdAt: -1 });
    res.json(mails);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (mail.receiver.toString() === req.user._id.toString()) {
      mail.isRead = true;
      await mail.save();
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (!mail) {
      return res.status(404).json({ error: 'Correo no encontrado' });
    }
    
    if (mail.sender.toString() === req.user._id.toString() || 
        mail.receiver.toString() === req.user._id.toString()) {
      
      if (!mail.deletedBy.includes(req.user._id)) {
        mail.deletedBy.push(req.user._id);
      }
      
      const bothDeleted = mail.deletedBy.includes(mail.sender.toString()) && 
                         mail.deletedBy.includes(mail.receiver.toString());
      
      if (bothDeleted) {
        if (mail.attachments && mail.attachments.length > 0) {
          mail.attachments.forEach(attachment => {
            const filePath = path.join(__dirname, '..', attachment.path);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
        }
        await Mail.findByIdAndDelete(req.params.id);
      } else {
        await mail.save();
      }
      
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'No tienes permiso para borrar este correo' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
