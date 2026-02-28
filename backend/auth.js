import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByUsername, createUser } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export async function register(username, password) {
  if (!username || !password) {
    throw new Error('Username and password required');
  }
  if (username.length < 2 || username.length > 30) {
    throw new Error('Username must be 2–30 characters');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (getUserByUsername(username)) {
    throw new Error('Username already taken');
  }
  const hash = await bcrypt.hash(password, 10);
  createUser(username, hash);
  return login(username, password);
}

export async function login(username, password) {
  const user = getUserByUsername(username);
  if (!user) {
    throw new Error('Invalid username or password');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('Invalid username or password');
  }
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    user: { id: user.id, username: user.username },
  };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
