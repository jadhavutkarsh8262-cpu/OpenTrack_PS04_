# ⚡ KURUKSHETRA Reel Studio (OP-04)
AI-powered vertical video converter and explainer reel studio. Converts long educational & coding videos into short 30–60 second vertical reels (9:16) with smart camera reframing and synchronized karaoke captions, and generates topic-prompt explainer reels with Remotion animated code & neural AI voiceovers.

---

## 🚀 Architecture & Tech Stack

- **Frontend**: React 18, Vite, Modern Glassmorphism & Custom CSS Tokens (`frontend/`).
- **Backend**: Python 3.10+, FastAPI, Uvicorn (`backend/app/`).
- **Audio & Speech**: `faster-whisper` (Hinglish Romanized speech-to-text with word-level timestamps), `librosa` (RMS voice excitement energy), `edge-tts` (Microsoft Neural TTS studio voices).
- **Computer Vision & Video**: FFmpeg (video cutting, scaling to 1080×1920, libass subtitle burn-in, audio muxing), OpenCV (`cv2` morphological text density tracking & motion diff), `pytesseract` (OCR code keyword localization).
- **LLM Engine**: Multi-provider support for **Google Gemini**, **Groq**, **Anthropic Claude**, and **OpenAI GPT-4o-mini**, plus intelligent offline heuristics.
- **Motion Graphics**: Remotion 4.0 (`remotion/`) for 60fps vertical animated code typing syntax & synchronized captions.

---

## 🔑 API Keys & Environment Configuration

All API keys are optional. The backend automatically detects whichever key you provide. If no key is set, the system seamlessly falls back to high-quality heuristic engines without crashing or breaking.

Edit `backend/.env`:
```env
# Choose any one (or more) of the following LLM providers:
GEMINI_API_KEY=your_gemini_api_key_here          # Recommended: Fast & generous free tier
GROQ_API_KEY=your_groq_api_key_here              # Ultra-fast LLaMA 3.3 70B
ANTHROPIC_API_KEY=your_anthropic_api_key_here    # Claude 3.5 Sonnet
OPENAI_API_KEY=your_openai_api_key_here          # GPT-4o-mini

# Speech-to-Text Whisper configuration
ENABLE_WHISPER=true
WHISPER_MODEL=tiny                               # Options: tiny, base, small (tiny runs fast on CPU)

# Voiceover TTS Voice for Explainer Reels
TTS_VOICE=en-US-ChristopherNeural                # Options: en-US-ChristopherNeural, en-IN-PrabhatNeural, etc.

# Frontend Origin for CORS
FRONTEND_ORIGIN=http://localhost:5173
```

---

## 🛠️ Beginner-Friendly Setup Instructions (Windows)

### Prerequisites:
1. **Python 3.10+**
2. **Node.js 18+**
3. **FFmpeg** installed and accessible on your PATH (`ffmpeg -version`)

### Step 1: Start Backend (FastAPI)
Open a PowerShell terminal:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend runs at `http://127.0.0.1:8000` (Swagger docs at `/docs`).

### Step 2: Start Frontend (React + Vite)
Open a second PowerShell terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

### Step 3: Remotion Setup (Mode 2 Explainer Reels)
In a third terminal (if not already installed):
```powershell
cd remotion
npm install
```

---

## 🌟 Feature Overview

| Feature | Implementation | Status |
|---|---|---|
| **Video Upload & Audio Extract** | FFmpeg 16kHz mono PCM extraction on upload | ✅ Complete |
| **Full Long Video Slicing** | Convert 20+ min videos into shorts via AI Highlights or Continuous Parts (Part 1, 2, 3...) | ✅ Complete |
| **Batch Export & Gallery** | Batch render all candidate reels across the entire video with interactive 9:16 gallery | ✅ Complete |
| **Hinglish Transcription** | `faster-whisper` CPU int8 with Romanized Hinglish prompt & word timestamps | ✅ Complete |
| **Technical Term Correction** | LLM API + Fuzzy Glossary matching (`useEffect`, `async/await`, `FastAPI`, etc.) | ✅ Complete |
| **Moment Detection (30–60s)** | Multimodal scoring: Librosa RMS voice energy + FFmpeg scene changes + LLM transcript score | ✅ Complete |
| **Smart 9:16 Reframing** | OpenCV code region detection + OCR keyword locator + smooth exponential glide | ✅ Complete |
| **Branding Kit & Watermark** | Top topic banner, creator handle (@tag), 5 accent colors, karaoke glow vs clean styles | ✅ Complete |
| **Editable Clip Boundaries** | Precise numeric inputs, scrub sliders, interactive timeline & in-player clip preview | ✅ Complete |
| **Topic Explainer Reels (Mode 2)** | AI script generator, editable storyboard scenes, Remotion animated typing code syntax | ✅ Complete |
| **Studio AI Voiceover (TTS)** | `edge-tts` neural voice narration (US, British, and Indian English accents) multiplexed with FFmpeg | ✅ Complete |
| **Video Export** | 1080×1920 MP4 H.264 / AAC with `+faststart` for instant preview and download | ✅ Complete |
