const mongoose = require('mongoose');

const MailSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  body: String,
  attachments: [{ filename: String, path: String, size: Number }],
  isRead: { type: Boolean, default: false },
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Track who deleted the mail
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mail', MailSchema);
