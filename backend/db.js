import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_from_bot INTEGER DEFAULT 0,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_created ON chat_sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
`);

export function createUser(username, passwordHash) {
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  return stmt.run(username, passwordHash);
}

export function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

export function createChatSession(userId, title = 'New Chat') {
  const stmt = db.prepare('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)');
  const result = stmt.run(userId, title);
  return result.lastInsertRowid;
}

export function getChatSessionsForUser(userId) {
  const stmt = db.prepare(`
    SELECT id, title, created_at
    FROM chat_sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(userId);
}

export function getChatSession(sessionId, userId) {
  const stmt = db.prepare(`
    SELECT id, title, created_at
    FROM chat_sessions
    WHERE id = ? AND user_id = ?
  `);
  return stmt.get(sessionId, userId);
}

export function addMessage(sessionId, content, isFromBot = false, imageUrl = null) {
  const stmt = db.prepare('INSERT INTO messages (session_id, content, is_from_bot, image_url) VALUES (?, ?, ?, ?)');
  return stmt.run(sessionId, content, isFromBot ? 1 : 0, imageUrl);
}

export function getMessagesForSession(sessionId, limit = 100) {
  const stmt = db.prepare(`
    SELECT id, content, is_from_bot, image_url, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `);
  return stmt.all(sessionId, limit);
}

export default db;
