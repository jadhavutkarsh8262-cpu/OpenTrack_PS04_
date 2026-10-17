# Reel Studio Deployment & Multi-Device Access Guide

This guide explains how to access **KURUKSHETRA Reel Studio** from multiple devices (mobile phones, tablets, other PCs) and how to deploy it 24/7 so it remains accessible through a public URL **even when your laptop is turned off**.

---

## 💡 Important Concept for Beginners

> **Why can't my laptop serve the website when it is switched off?**  
> When your laptop is turned off or in sleep mode, its processor and network card are powered down. It cannot respond to incoming web traffic. To have a public URL that works **24/7 with your laptop powered off**, your app must run on cloud servers (such as Render, Vercel, or Railway) that never sleep.

---

## 📱 Quick Test: Access on Your Phone Right Now (Same Wi-Fi)

While working on your laptop, your Vite frontend server is now configured with `--host 0.0.0.0`, meaning any device connected to your Wi-Fi or hotspot can open it immediately:

1. Connect your phone or second laptop to the same Wi-Fi network.
2. Open your mobile browser (Chrome/Safari) and go to:
   ```text
   http://10.10.232.224:5173
   ```
   *(or whichever local network IP is shown in your terminal when you start Vite)*.
3. The app will open and communicate with your backend API seamlessly.

---

## 🌐 24/7 Public Cloud Deployment (Works With Laptop Switched Off)

We have already configured your project with `render.yaml`, `Dockerfile`, and `vercel.json`. You can deploy for free using either method below:

### Method 1: 1-Click Full Stack on Render.com (Recommended & Easiest)

Render can build your Docker backend (with Python + FFmpeg) and your React frontend together using the included `render.yaml` blueprint.

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure 24/7 cloud deployment"
   git push origin main
   ```
2. **Log into [Render.com](https://render.com)** (Free sign-up with GitHub).
3. Click **New +** → Select **Blueprint**.
4. Connect your GitHub repository.
5. Render will detect `render.yaml` and automatically configure:
   - **`reel-studio-backend`**: Docker Web Service running FastAPI & FFmpeg.
   - **`reel-studio-frontend`**: Static Site running your React Vite app.
   - Automatically links the backend URL to the frontend's `VITE_API_URL`.
6. Click **Apply**.
7. Once finished, Render gives you a public `.onrender.com` URL (e.g., `https://reel-studio-frontend.onrender.com`).
   - Anyone in the world can open this link on phones, tablets, or computers 24/7 even with your laptop switched off!

---

### Method 2: Vercel (Frontend) + Render / Railway (Backend)

If you prefer Vercel for high-speed edge frontend hosting:

#### Step A: Deploy Backend (Docker)
1. In [Render.com](https://render.com) or [Railway.app](https://railway.app), create a **New Web Service** from your GitHub repo.
2. Root directory: `backend`
3. Environment: `Docker` (or select `backend/Dockerfile`).
4. Set Environment Variables:
   - `PORT`: `8000`
   - `ENABLE_WHISPER`: `false`
   - `ANTHROPIC_API_KEY`: *(Optional Claude API key)*
5. Click **Deploy**. Note down your live backend URL (e.g., `https://reel-backend.onrender.com`).

#### Step B: Deploy Frontend on Vercel
1. Go to [Vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://reel-backend.onrender.com` *(your live backend URL from Step A)*
5. Click **Deploy**.
6. Vercel will build and give you a fast global domain (e.g. `https://reel-studio.vercel.app`).

---

## ⚡ Instant Public URL While Laptop is On (Cloudflare Tunnel)

If you want a free, secure public HTTPS URL to demo right now without deploying to the cloud yet:

Your repository already includes `cloudflared.exe`! Run this command:

```powershell
.\cloudflared.exe tunnel --url http://localhost:5173
```

Cloudflare will give you a temporary public URL like `https://random-words.trycloudflare.com` that you can immediately send to judges, teachers, or open on your smartphone!

---

## 💻 Exact Terminal Commands to Run Locally

If you ever restart your machine or need to run locally, follow these exact commands:

### Terminal 1 — Backend (FastAPI + FFmpeg):
```powershell
cd "c:\Users\UTKARSH JADHAV\OneDrive\Desktop\hackathon\reel-studio\backend"
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Health check: `http://localhost:8000/api/health`*

### Terminal 2 — Frontend (React Vite):
```powershell
cd "c:\Users\UTKARSH JADHAV\OneDrive\Desktop\hackathon\reel-studio\frontend"
npm run dev
```
*Open in browser: `http://localhost:5173`*
