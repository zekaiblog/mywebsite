import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import { verifyToken } from './auth.js';
import * as db from './db.js';
import { getBotReply } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const corsOrigin = process.env.FRONTEND_URL || (isProduction ? false : 'http://localhost:5173');
const io = new Server(httpServer, {
  cors: { origin: corsOrigin || true, credentials: true },
});

app.use(cors({ origin: corsOrigin || true, credentials: true }));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { register } = await import('./auth.js');
    const result = await register(req.body.username, req.body.password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { login } = await import('./auth.js');
    const result = await login(req.body.username, req.body.password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Get current user (optional, for frontend)
app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.getUserById(payload.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user });
});

// Get chat sessions
app.get('/api/sessions', (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const sessions = db.getChatSessionsForUser(payload.userId);
  res.json({ sessions });
});

// Create new chat session
app.post('/api/sessions', (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const title = req.body.title || 'New Chat';
  const sessionId = db.createChatSession(payload.userId, title);
  const session = db.getChatSession(sessionId, payload.userId);
  res.json({ session });
});

// Get chat history for a session
app.get('/api/messages/:sessionId', (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const sessionId = parseInt(req.params.sessionId);
  const session = db.getChatSession(sessionId, payload.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const messages = db.getMessagesForSession(sessionId);
  res.json({ messages, session });
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Serve frontend in production (API routes above take precedence)
if (isProduction) {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

// Socket: require auth and handle chat + bot reply
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = verifyToken(token);
  if (!payload) {
    return next(new Error('Authentication required'));
  }
  socket.userId = payload.userId;
  socket.username = payload.username;
  next();
});

io.on('connection', (socket) => {
  socket.on('join:session', (sessionId) => {
    // Verify the session belongs to the user
    const session = db.getChatSession(sessionId, socket.userId);
    if (session) {
      socket.sessionId = sessionId;
      socket.join(`session:${sessionId}`);
      socket.emit('session:joined', session);
    }
  });

  socket.on('chat:message', async (data) => {
    if (!socket.sessionId) return;

    const { content, imageUrl } = data;
    if (!content || typeof content !== 'string') return;
    const text = content.trim().slice(0, 2000);
    if (!text) return;

    db.addMessage(socket.sessionId, text, false, imageUrl);
    io.to(`session:${socket.sessionId}`).emit('chat:message', {
      content: text,
      imageUrl,
      isFromBot: false,
      createdAt: new Date().toISOString(),
    });

    // Bot reply
    const history = db.getMessagesForSession(socket.sessionId, 20);
    const reply = await getBotReply(text, history, imageUrl);
    db.addMessage(socket.sessionId, reply, true);

    io.to(`session:${socket.sessionId}`).emit('chat:message', {
      content: reply,
      isFromBot: true,
      createdAt: new Date().toISOString(),
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
