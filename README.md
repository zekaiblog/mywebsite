# My Website – Web Chat with AI Assistant

A simple “web WeChat” style site: visitors can **register**, **log in**, and **chat**. Replies are powered by **DeepSeek** so your site has an automatic chatbot.

## Features

- **User registration** – username + password (stored securely with bcrypt)
- **Login** – JWT-based sessions
- **Real-time chat** – WebSocket (Socket.io) so messages appear instantly
- **AI replies** – DeepSeek answers visitors; each user has their own conversation history

## Quick start (local)

### 1. Backend

```bash
cd mywebsite/backend
cp .env.example .env
# Edit .env: set JWT_SECRET and DEEPSEEK_API_KEY (see below)
npm install
npm run dev
```

Backend runs at **http://localhost:3001**.

### 2. Frontend

```bash
cd mywebsite/frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**. Open that URL and you can register, log in, and chat; the bot will reply via DeepSeek.

### 3. Environment variables (backend `.env`)

| Variable          | Description |
|-------------------|-------------|
| `PORT`            | Server port (default `3001`) |
| `JWT_SECRET`      | Secret for signing JWTs (use a long random string in production) |
| `DEEPSEEK_API_KEY` | API key from [DeepSeek Platform](https://platform.deepseek.com) |

Without `DEEPSEEK_API_KEY`, the bot will respond with a “not configured” message.

---

## How to put the site online (deployment)

You need a **public server** (or serverless backend + frontend) so “everyone can see and visit” it. Here are practical options.

### Option A: Single VPS (e.g. Railway, Render, or your own server)

One server runs both the Node backend and the built frontend.

1. **Get a Node server**  
   - [Railway](https://railway.app): connect your repo, set root to `mywebsite/backend`, add build command and start command.  
   - [Render](https://render.com): create a Web Service, point to the same backend folder.  
   - Or use a VPS (DigitalOcean, Linode, etc.) and run Node yourself.

2. **Build the frontend and serve it from the backend**  
   - On your machine or in CI:
     ```bash
     cd mywebsite/frontend
     npm ci
     npm run build
     ```
   - Backend is already set up to serve `frontend/dist` when `NODE_ENV=production` (see `server.js`). So you need to either:
     - Deploy the **whole `mywebsite` folder** (backend + `frontend/dist`), and run the server from `backend`, or  
     - In your deploy config, after building the frontend, copy `frontend/dist` into `backend` (e.g. `backend/public`) and change `server.js` to use that path; then deploy only the backend.

3. **Set environment variables on the host**  
   - `NODE_ENV=production`  
   - `JWT_SECRET` – long random string  
   - `DEEPSEEK_API_KEY` – from DeepSeek  
   - `PORT` – if the host uses a fixed port (e.g. Render uses `PORT` automatically).

4. **Domain / URL**  
   - Point a domain (e.g. `chat.yoursite.com`) to the deployed app.  
   - If you use a subpath (e.g. `yoursite.com/chat`), you’d need to set a base path in the frontend and possibly a reverse proxy; for the first version, using the root URL is simplest.

Result: visitors go to your URL → register/login → chat; the bot replies using DeepSeek.

### Option B: Frontend and backend on different hosts

- **Frontend**: build with `npm run build` and deploy the `frontend/dist` folder to **Vercel**, **Netlify**, or any static host.  
- **Backend**: deploy the `backend` folder to Railway, Render, or a VPS.  
- Set **CORS and Socket.io** to allow your frontend origin:
  - On the backend, set `FRONTEND_URL` to your frontend URL (e.g. `https://mywebsite.vercel.app`).  
- In the frontend, set **API URL** so it talks to the backend:
  - Create `frontend/.env.production` with:
    ```bash
    VITE_API_URL=https://your-backend-url.com
    ```
  - Rebuild the frontend (`npm run build`) and deploy again.

Then visitors use the frontend URL; the frontend will call and connect to your backend for auth and chat.

### Option C: Your own server (VPS)

1. **Server**: e.g. Ubuntu on DigitalOcean/Linode (e.g. $5–6/month).  
2. **Install Node** (v18+):  
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. **Clone/copy your project** to the server (e.g. `/var/www/mywebsite`).  
4. **Build frontend**:  
   ```bash
   cd /var/www/mywebsite/frontend && npm ci && npm run build
   ```
5. **Run backend** (production):  
   ```bash
   cd /var/www/mywebsite/backend
   npm ci --omit=dev
   NODE_ENV=production PORT=3001 node server.js
   ```
   Use **PM2** or **systemd** to keep it running and restart on reboot.  
6. **Reverse proxy (Nginx)** so the site is on port 80/443 and you can add HTTPS:
   - Nginx listens on 80/443 and proxies to `http://127.0.0.1:3001`.  
   - Use **Let’s Encrypt** (e.g. `certbot`) for SSL so the site is `https://yoursite.com`.

---

## Project structure

```
mywebsite/
├── backend/           # Express + Socket.io + SQLite + DeepSeek
│   ├── server.js      # API + WebSocket server, serves frontend in production
│   ├── auth.js        # Register / login / JWT
│   ├── db.js          # SQLite: users, messages
│   ├── deepseek.js    # Calls DeepSeek API for bot replies
│   ├── .env.example
│   └── package.json
├── frontend/          # React (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/  # Login, Register, Chat
│   │   └── ...
│   └── package.json
└── README.md
```

## Summary

- **Local**: run backend and frontend as in “Quick start”; set `DEEPSEEK_API_KEY` and `JWT_SECRET` in `backend/.env`.  
- **Online**: deploy backend (and optionally frontend) to a host, set `NODE_ENV=production`, `JWT_SECRET`, `DEEPSEEK_API_KEY`, and (if split) `FRONTEND_URL` / `VITE_API_URL`.  
- **DeepSeek**: get an API key from [DeepSeek Platform](https://platform.deepseek.com) and add it to `.env` so the chatbot works.

After that, anyone can visit your site, register, and chat with your DeepSeek-powered assistant.
