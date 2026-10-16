# Reel Studio (OP-04)
React (`frontend/`) + FastAPI (`backend/`) + Remotion (`remotion/`). Each folder has its own dependencies.

## Setup (Windows PowerShell)
```powershell
cd backend; py -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt; copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
New terminal: `cd frontend; copy .env.example .env; npm install; npm run dev` (open http://localhost:5173)
Optional: `pip install faster-whisper` + `ENABLE_WHISPER=true`; put `ANTHROPIC_API_KEY` in `backend/.env`; `cd remotion; npm install`. FFmpeg must be on PATH.

## API
`GET /api/health` · `POST /api/upload` · `POST /api/projects/{id}/analyze` · `POST /api/projects/{id}/render {start,end}` · `GET /api/exports/{file}` · `POST /api/topic-video {topic, render}`. API keys live only in backend `.env`.

## Working vs placeholder
| Feature | Status |
|---|---|
| Upload, FFmpeg cut, 9:16 reframe following screen changes, karaoke captions | Implemented (needs testing on real class videos) |
| Whisper word timestamps, glossary + LLM term correction | Needs `ENABLE_WHISPER=true` + API key; otherwise labelled DEMO |
| Highlights (LLM + voice energy + scene change, sentence-aligned) | Same as above; DEMO uses one fixed clip |
| Timeline | Sliders + clip bar; no waveform yet |
| Mode 2 script | LLM if key set, else template. Remotion renders animated code + captions |
| Voiceover (TTS), OCR code captions, brand kit, auth, publishing | Not built |
