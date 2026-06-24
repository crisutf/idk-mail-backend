require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');
const User = require('./models/User');
const PublicMessage = require('./models/PublicMessage');
const PrivateMessage = require('./models/PrivateMessage');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const mailRoutes = require('./routes/mails');
const profileRoutes = require('./routes/profile');
const friendRoutes = require('./routes/friends');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 2053;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/idk-mail';

// Función para parsear orígenes CORS
const parseCorsOrigins = () => {
  const originStr = process.env.CORS_ORIGIN;
  if (!originStr || originStr === '*') return true;
  
  const origins = originStr.split(',').map(o => o.trim());
  if (origins.length === 1 && !origins[0]) return true;
  if (origins.length === 1) return origins[0];
  
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  };
};

const CORS_ORIGIN = parseCorsOrigins();

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mails', mailRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

const initAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const admin = new User({
        username: 'admin',
        email: 'admin@idk-mail.local',
        password: hashedPassword,
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Usuario admin creado: admin@idk-mail.local / admin123');
    }
  } catch (error) {
    console.error('❌ Error creando admin:', error);
  }
};

const startServer = async () => {
  await connectDB(MONGODB_URI);
  await initAdmin();

  let server;
  try {
    const keyPath = path.join(__dirname, 'certs', 'server.key');
    const certPath = path.join(__dirname, 'certs', 'server.cert');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const credentials = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      server = https.createServer(credentials, app);
      console.log('✅ Servidor HTTPS iniciando en puerto ' + PORT + ' con certificados SSL');
    } else {
      console.log('⚠️ No se encontraron certificados SSL en ./certs/, usando HTTP');
      server = http.createServer(app);
    }
  } catch (error) {
    console.log('⚠️ Error cargando certificados SSL, usando HTTP:', error);
    server = http.createServer(app);
  }

  const io = socketIo(server, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const userSockets = new Map();
  const lastMessageTime = new Map();
  const spamCount = new Map();

  io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'idk-mail-super-secret-key-2025');
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
          currentUser = user;
          userSockets.set(user._id.toString(), socket.id);
        }
      } catch (error) {
        console.log('⚠️ Error de autenticación en socket');
      }
    });

    socket.on('public-message', async (data) => {
      if (!currentUser) return;

      const now = Date.now();
      const lastTime = lastMessageTime.get(currentUser._id.toString()) || 0;
      const cooldown = 5000;

      if (now - lastTime < cooldown) {
        const count = (spamCount.get(currentUser._id.toString()) || 0) + 1;
        spamCount.set(currentUser._id.toString(), count);

        if (count >= 5) {
          currentUser.isActive = false;
          await currentUser.save();
          socket.emit('banned');
          return;
        }
        return;
      }

      lastMessageTime.set(currentUser._id.toString(), now);
      spamCount.set(currentUser._id.toString(), 0);

      const message = new PublicMessage({
        user: currentUser._id,
        message: data.message
      });
      await message.save();

      const populatedMessage = await PublicMessage.findById(message._id)
        .populate('user', 'username');

      io.emit('public-message', populatedMessage);
    });

    socket.on('private-message', async (data) => {
      if (!currentUser) return;

      const message = new PrivateMessage({
        sender: currentUser._id,
        receiver: data.receiverId,
        message: data.message
      });
      await message.save();

      const populatedMessage = await PrivateMessage.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('receiver', 'username avatar');

      // Emitir al remitente y al destinatario
      socket.emit('private-message', populatedMessage);
      const receiverSocketId = userSockets.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('private-message', populatedMessage);
        io.to(receiverSocketId).emit('notification', {
          type: 'private-message',
          from: currentUser.username,
          message: data.message
        });
      }
    });

    socket.on('disconnect', () => {
      if (currentUser) {
        userSockets.delete(currentUser._id.toString());
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
};

startServer();
