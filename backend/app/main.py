import json, shutil, time, uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from . import config as cfg
from .services import transcribe, highlights, render as rnd, llm, remotion, audio, tts

app = FastAPI(title="Reel Studio API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
PD = cfg.ROOT / "storage" / "projects"; PD.mkdir(parents=True, exist_ok=True)

def load(pid):
    f = PD / f"{Path(pid).name}.json"
    if not f.exists(): raise HTTPException(404, "Project not found")
    return json.loads(f.read_text(encoding="utf-8"))

def save(p):
    (PD / f"{p['id']}.json").write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")

@app.get("/api/health")
def health():
    has_llm = bool(cfg.ANTHROPIC_API_KEY or cfg.OPENAI_API_KEY or cfg.GEMINI_API_KEY or cfg.GROQ_API_KEY)
    return {
        "status": "ok",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "whisper": cfg.ENABLE_WHISPER,
        "whisper_model": cfg.WHISPER_MODEL,
        "llm": has_llm,
        "llm_provider": llm.get_active_provider(),
        "tts": True,
        "remotion": (cfg.REMOTION_DIR / "node_modules").exists()
    }

@app.get("/api/voices")
def get_voices():
    return tts.list_voices()

class TtsPreviewReq(BaseModel):
    text: str = "Welcome to Reel Studio. Here is your AI voiceover sample."
    voice: str = "en-US-ChristopherNeural"

@app.post("/api/tts-preview")
async def tts_preview(b: TtsPreviewReq):
    out = cfg.EXPORTS / f"preview_{int(time.time())}_{uuid.uuid4().hex[:4]}.mp3"
    await tts.synthesize_text(b.text, out, voice=b.voice)
    return {"audio_url": f"/api/exports/{out.name}"}

@app.post("/api/upload")
def upload(video: UploadFile = File(...)):
    if not video.filename:
        raise HTTPException(400, "No file uploaded.")
    ext = Path(video.filename or "").suffix.lower()
    if ext not in {".mp4", ".mov", ".webm"}:
        raise HTTPException(400, "Use MP4, MOV or WebM format.")
    pid = uuid.uuid4().hex
    name = pid + ext
    target_path = cfg.UPLOADS / name
    with open(target_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    # Immediately extract 16kHz mono audio for whisper & librosa
    try:
        audio.extract_wav(target_path)
    except Exception as e:
        print("Initial audio extract warning:", e)

    dur = audio.get_duration(target_path) or highlights.duration(target_path) or 60.0
    initial_clips = highlights.fallback_clips(target_path, dur, n=6)
    p = {
        "id": pid,
        "file": name,
        "name": video.filename,
        "url": f"/api/uploads/{name}",
        "duration": dur,
        "clips": initial_clips,
        "words": []
    }
    save(p)
    return p

@app.get("/api/uploads/{name}")
def get_upload(name: str):
    f = cfg.UPLOADS / Path(name).name
    if not f.exists(): raise HTTPException(404, "Upload not found")
    return FileResponse(f, media_type="video/mp4", filename=f.name)

@app.post("/api/projects/{pid}/analyze")
def analyze(pid: str):
    p = load(pid)
    src = cfg.UPLOADS / p["file"]
    d = float(p.get("duration") or audio.get_duration(src) or 90.0)
    t = transcribe.run(src)

    if t["mode"] == "demo":
        clips = highlights.fallback_clips(src, d, n=6)
    else:
        clips = highlights.find_clips(src, t.get("words", []), dur=d, n=6)
        if not clips:
            clips = highlights.fallback_clips(src, d, n=6)

    p.update(mode=t["mode"], words=t.get("words", []), clips=clips, duration=d)
    save(p)
    return p

@app.get("/api/projects")
def list_projects():
    """List all uploaded video projects with metadata and timestamps, newest first."""
    projects = []
    for f in sorted(PD.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            projects.append({
                "id": data.get("id"),
                "name": data.get("name") or data.get("file"),
                "file": data.get("file"),
                "duration": data.get("duration", 0),
                "clips_count": len(data.get("clips") or []),
                "mode": data.get("mode", "standard"),
                "has_words": len(data.get("words") or []) > 0,
                "url": data.get("url"),
                "updated_at": f.stat().st_mtime
            })
        except Exception:
            pass
    return projects

@app.get("/api/projects/{pid}")
def get_project(pid: str):
    return load(pid)

class SplitReq(BaseModel):
    strategy: str = "highlights" # "highlights" or "continuous"
    chunk_len: Optional[float] = 45.0
    num_clips: Optional[int] = 6

@app.post("/api/projects/{pid}/split")
def split_project_clips(pid: str, b: SplitReq):
    """Regenerate candidate reels from long video using either AI highlights or continuous sequential parts."""
    p = load(pid)
    src = cfg.UPLOADS / p["file"]
    dur = float(p.get("duration") or audio.get_duration(src) or 60.0)
    words = p.get("words", [])
    chunk_len = max(20.0, min(120.0, float(b.chunk_len or 45.0)))

    if b.strategy == "continuous":
        clips = highlights.split_continuous_parts(src, dur, chunk_len=chunk_len, words=words)
    else:
        n = max(2, min(20, int(b.num_clips or 6)))
        if words:
            clips = highlights.find_clips(src, words, dur=dur, n=n, chunk_len=chunk_len)
        else:
            clips = highlights.fallback_clips(src, dur, n=n, chunk_len=chunk_len)

    p["clips"] = clips
    save(p)
    return p

class RenderReq(BaseModel):
    start: float
    end: float
    title: Optional[str] = None
    brand: Optional[Dict[str, Any]] = None

@app.post("/api/projects/{pid}/render")
def render(pid: str, b: RenderReq):
    p = load(pid)
    if b.end <= b.start:
        raise HTTPException(400, "End timestamp must be greater than start timestamp.")
    if b.end - b.start > 180:
        raise HTTPException(400, "Maximum reel duration is 3 minutes (180s). Please select a shorter segment.")

    out = cfg.EXPORTS / f"{pid}_{int(time.time())}_{uuid.uuid4().hex[:6]}.mp4"
    try:
        rnd.render(
            cfg.UPLOADS / p["file"],
            p.get("words", []),
            b.start,
            b.end,
            out,
            brand=b.brand
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))

    return {
        "download": f"/api/exports/{out.name}",
        "filename": out.name,
        "title": b.title or f"Reel ({highlights.format_time_label(b.start)} - {highlights.format_time_label(b.end)})",
        "start": b.start,
        "end": b.end,
        "duration": round(b.end - b.start, 1)
    }

class BatchRenderReq(BaseModel):
    clip_indices: Optional[List[int]] = None
    brand: Optional[Dict[str, Any]] = None

@app.post("/api/projects/{pid}/batch-render")
def batch_render(pid: str, b: BatchRenderReq):
    """Batch render multiple or all candidate reels from the long video into 9:16 vertical shorts."""
    p = load(pid)
    src = cfg.UPLOADS / p["file"]
    clips = p.get("clips", [])
    if not clips:
        raise HTTPException(400, "No clips found in project to render.")

    indices = b.clip_indices if b.clip_indices is not None else list(range(len(clips)))
    results = []

    for idx in indices:
        if idx < 0 or idx >= len(clips):
            continue
        clip = clips[idx]
        s = float(clip["start"])
        e = float(clip["end"])
        clip_title = clip.get("title", f"Reel #{idx+1}")
        out_name = f"{pid}_reel{idx+1}_{int(time.time())}_{uuid.uuid4().hex[:4]}.mp4"
        out_path = cfg.EXPORTS / out_name

        try:
            rnd.render(
                src,
                p.get("words", []),
                s,
                e,
                out_path,
                brand=b.brand
            )
            results.append({
                "index": idx,
                "title": clip_title,
                "start": s,
                "end": e,
                "duration": round(e - s, 1),
                "download": f"/api/exports/{out_name}",
                "filename": out_name,
                "status": "ready"
            })
        except Exception as err:
            results.append({
                "index": idx,
                "title": clip_title,
                "start": s,
                "end": e,
                "error": str(err),
                "status": "failed"
            })

    return {"reels": results}

@app.get("/api/exports/{name}")
def export(name: str):
    f = cfg.EXPORTS / Path(name).name
    if not f.exists(): raise HTTPException(404, "Not found")
    media_type = "audio/mpeg" if f.suffix.lower() == ".mp3" else "video/mp4"
    return FileResponse(f, media_type=media_type, filename=f.name)

class TopicReq(BaseModel):
    topic: str
    render: bool = False
    voice: Optional[str] = "en-US-ChristopherNeural"
    scenes: Optional[List[Dict[str, Any]]] = None

@app.post("/api/topic-video")
def topic_video(b: TopicReq):
    topic_str = b.topic.strip()
    if not topic_str:
        raise HTTPException(400, "Please provide a topic or prompt.")

    if b.scenes and len(b.scenes) > 0:
        scenes = b.scenes
        mode = "custom-edited"
    else:
        s = llm.script(topic_str)
        scenes = s["scenes"]
        mode = s["mode"]

    res = {"mode": mode, "scenes": scenes, "topic": topic_str}

    if b.render:
        rem_res = remotion.render(scenes, topic_str, voice=b.voice or "en-US-ChristopherNeural")
        if rem_res.get("error"):
            raise HTTPException(500, rem_res["error"])
        res.update(rem_res)

    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

