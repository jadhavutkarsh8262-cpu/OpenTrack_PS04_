import json, shutil, time, uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from . import config as cfg
from .services import transcribe, highlights, render as rnd, llm, remotion

app = FastAPI(title="Reel Studio API")
origins = list({cfg.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"})
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=".*", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
PD = cfg.ROOT / "storage" / "projects"; PD.mkdir(parents=True, exist_ok=True)

def load(pid):
    f = PD / f"{Path(pid).name}.json"
    if not f.exists(): raise HTTPException(404, "Project not found")
    return json.loads(f.read_text(encoding="utf-8"))
def save(p): (PD / f"{p['id']}.json").write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")

@app.get("/api/health")
def health():
    return {"status": "ok", "ffmpeg": bool(shutil.which("ffmpeg")), "whisper": cfg.ENABLE_WHISPER,
            "llm": bool(cfg.ANTHROPIC_API_KEY), "remotion": (cfg.REMOTION_DIR / "node_modules").exists()}

@app.post("/api/upload")
def upload(video: UploadFile = File(...)):
    if not video.filename:
        raise HTTPException(400, "No file uploaded.")
    ext = Path(video.filename or "").suffix.lower()
    if ext not in {".mp4", ".mov", ".webm"}: raise HTTPException(400, "Use MP4, MOV or WebM format.")
    pid = uuid.uuid4().hex; name = pid + ext
    target_path = cfg.UPLOADS / name
    with open(target_path, "wb") as f: shutil.copyfileobj(video.file, f)
    dur = highlights.duration(target_path)
    p = {"id": pid, "file": name, "name": video.filename, "url": f"/api/uploads/{name}", "duration": dur, "clips": []}
    save(p); return p

@app.get("/api/uploads/{name}")
def get_upload(name: str):
    f = cfg.UPLOADS / Path(name).name
    if not f.exists(): raise HTTPException(404, "Upload not found")
    return FileResponse(f, media_type="video/mp4", filename=f.name)

@app.post("/api/projects/{pid}/analyze")
def analyze(pid: str):
    p = load(pid); src = cfg.UPLOADS / p["file"]; t = transcribe.run(src); d = p["duration"] or 90
    if t["mode"] == "demo":
        clips = [{"start": 0, "end": min(45, d), "title": "DEMO clip", "score": 0,
                  "reason": "DEMO placeholder. Set ENABLE_WHISPER=true for real highlights."}]
    else:
        clips = highlights.find_clips(src, t["words"]) or [{"start": 0, "end": min(60, d), "title": "Full clip", "score": 0, "reason": "Too short to score."}]
    p.update(mode=t["mode"], words=t["words"], clips=clips); save(p); return p

class RenderReq(BaseModel): start: float; end: float

@app.post("/api/projects/{pid}/render")
def render(pid: str, b: RenderReq):
    p = load(pid)
    if b.end <= b.start:
        raise HTTPException(400, "End timestamp must be greater than start timestamp.")
    if b.end - b.start > 180:
        raise HTTPException(400, "Maximum reel duration is 3 minutes (180s). Please select a shorter segment.")
    out = cfg.EXPORTS / f"{pid}_{int(time.time())}.mp4"
    try:
        rnd.render(cfg.UPLOADS / p["file"], p.get("words", []), b.start, b.end, out)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))
    return {"download": f"/api/exports/{out.name}", "filename": out.name}

@app.get("/api/exports/{name}")
def export(name: str):
    f = cfg.EXPORTS / Path(name).name
    if not f.exists(): raise HTTPException(404, "Not found")
    return FileResponse(f, media_type="video/mp4", filename=f.name)

class TopicReq(BaseModel): topic: str; render: bool = False

@app.post("/api/topic-video")
def topic_video(b: TopicReq):
    s = llm.script(b.topic); res = {"mode": s["mode"], "scenes": s["scenes"]}
    if b.render:
        rem_res = remotion.render(s["scenes"], b.topic)
        res.update(rem_res)
    return res
