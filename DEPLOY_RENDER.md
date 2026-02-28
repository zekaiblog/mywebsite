# Deploy My Website to Render

Follow these steps to put your chat site online on [Render](https://render.com).

---

## 1. Push your code to GitHub

Render deploys from a Git repo. If you haven’t already:

1. Create a new repo on [GitHub](https://github.com/new).
2. In your project folder (the one that contains `mywebsite`), run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

If your repo root is **inside** `mywebsite` (i.e. you ran `git init` inside `mywebsite/`), use the **“Repo root = mywebsite”** option in step 3 below and leave **Root Directory** empty on Render.

---

## 2. Create a Render account

1. Go to [render.com](https://render.com) and sign up (GitHub login is easiest).
2. Connect your GitHub account when asked so Render can see your repos.

---

## 3. Create a Web Service

1. In the Render dashboard, click **New** → **Web Service**.
2. Connect the repository that contains `mywebsite` (or select it if it’s already connected).
3. Configure the service:

   | Field | Value |
   |-------|--------|
   | **Name** | `mywebsite` (or any name you like) |
   | **Region** | Choose one close to you |
   | **Branch** | `main` |
   | **Root Directory** | `mywebsite` — **only if** your repo root is the parent of `mywebsite`. Leave blank if your repo root is already inside `mywebsite`. |
   | **Runtime** | `Node` |
   | **Build Command** | `npm run install:all && npm run build` |
   | **Start Command** | `npm start` |

4. Click **Advanced** and add environment variables (see step 4 below).
5. Click **Create Web Service**.

Render will run the build, then start your app. The first deploy may take a few minutes.

---

## 4. Set environment variables

In your Web Service → **Environment** tab, add:

| Key | Value | Notes |
|-----|--------|--------|
| `NODE_ENV` | `production` | So the app serves the built frontend and uses production settings. |
| `JWT_SECRET` | *(random string)* | Use a long random string, e.g. run `openssl rand -hex 32` and paste the result. **Do not share or commit this.** |
| `DEEPSEEK_API_KEY` | *(your key)* | From [DeepSeek Platform](https://platform.deepseek.com). Required for the chatbot to reply. |

Render sets `PORT` for you; your app already uses `process.env.PORT`, so you don’t need to add it.

---

## 5. Get your live URL

After the first successful deploy:

- Your site will be at: **`https://YOUR_SERVICE_NAME.onrender.com`**
- You can add a **custom domain** later under **Settings** → **Custom Domain**.

---

## 6. Optional: use a Blueprint (render.yaml)

If you prefer to define the service in code:

1. In the repo root (parent of `mywebsite`), add a `render.yaml` that points to the `mywebsite` service (you can use the one in `mywebsite/render.yaml` as reference, but the `rootDir` there assumes the repo root is the parent of `mywebsite`).
2. In Render: **New** → **Blueprint**, connect the repo, and Render will create the Web Service from the YAML.

You still need to set `DEEPSEEK_API_KEY` (and optionally `JWT_SECRET`) in the Render **Environment** tab; the YAML can mark them as “set manually.”

---

## Troubleshooting

- **Build fails on “install:all” or “build”**  
  Make sure **Root Directory** is set correctly: if the repo root is the folder that **contains** `mywebsite`, set Root Directory to `mywebsite`. If the repo root is **inside** `mywebsite`, leave Root Directory blank and use the same build/start commands from the `mywebsite` folder.

- **“Cannot find module” or start fails**  
  Build command must run from the same directory as `package.json` that has `install:all` and `build` (i.e. the `mywebsite` folder when Root Directory is `mywebsite`).

- **Chat or WebSocket not working**  
  Render’s free tier supports WebSockets. If you put a CDN or proxy in front later, it must support WebSockets (e.g. Cloudflare with WebSockets enabled).

- **Bot doesn’t reply**  
  Check that `DEEPSEEK_API_KEY` is set in the Render Environment tab and that the key is valid on the DeepSeek platform.

---

## Summary

1. Push code to GitHub.  
2. On Render: New → Web Service, connect repo, set Root Directory to `mywebsite` if needed.  
3. Build: `npm run install:all && npm run build`  
4. Start: `npm start`  
5. Add env vars: `NODE_ENV`, `JWT_SECRET`, `DEEPSEEK_API_KEY`.  
6. Use the `.onrender.com` URL (or add a custom domain).

Your site will be live at that URL; visitors can register, log in, and chat with your DeepSeek-powered assistant.
