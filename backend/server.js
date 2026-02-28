import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import { verifyToken } from './auth.js';
import * as db from './db.js';
import { getBotReply } from './deepseek.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

const corsOrigin = process.env.FRONTEND_URL || (isProduction ? false : 'http://localhost:5173');
const io = new Server(httpServer, {
  cors: { origin: corsOrigin || true, credentials: true },
});

app.use(cors({ origin: corsOrigin || true, credentials: true }));
app.use(express.json());

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

// Get chat history
app.get('/api/messages', (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const messages = db.getMessagesForUser(payload.userId);
  res.json({ messages });
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
  socket.join(`user:${socket.userId}`);

  socket.on('chat:message', async (content) => {
    if (!content || typeof content !== 'string') return;
    const text = content.trim().slice(0, 2000);
    if (!text) return;

    db.addMessage(socket.userId, text, false);
    io.to(`user:${socket.userId}`).emit('chat:message', {
      content: text,
      isFromBot: false,
      createdAt: new Date().toISOString(),
    });

    // Bot reply
    const history = db.getMessagesForUser(socket.userId, 20);
    const reply = await getBotReply(text, history);
    db.addMessage(socket.userId, reply, true);

    io.to(`user:${socket.userId}`).emit('chat:message', {
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
