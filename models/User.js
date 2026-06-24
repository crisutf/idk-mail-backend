const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  storageUsed: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 10 * 1024 * 1024 * 1024 }, // 10GB
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  bannedAt: Date,
  deletedAt: Date,
  avatar: String,
  bio: String,
  ip: String,
  lastLogin: Date,
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
