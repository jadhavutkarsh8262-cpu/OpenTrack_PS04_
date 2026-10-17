import difflib
from pathlib import Path
from .. import config as cfg
from . import llm, audio

# Ensure PyAV 19+ compatibility with faster-whisper
try:
    import av
    _orig_av_open = av.open
    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _safe_av_open
except Exception:
    pass

COMMON_TECH_MAP = {
    "use effect": "useEffect",
    "use state": "useState",
    "use context": "useContext",
    "use memo": "useMemo",
    "use callback": "useCallback",
    "fast api": "FastAPI",
    "fastapi": "FastAPI",
    "react js": "ReactJS",
    "next js": "Next.js",
    "node js": "Node.js",
    "mongo db": "MongoDB",
    "postgre sql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "kuber netes": "Kubernetes",
    "spring boot": "Spring Boot",
    "type script": "TypeScript",
    "java script": "JavaScript",
    "docker file": "Dockerfile",
    "git hub": "GitHub"
}

def glossary_fix(words):
    if not words:
        return words
    low = {g.lower(): g for g in cfg.GLOSSARY}
    for w in words:
        core = w["w"].strip(".,?!\"'").strip()
        core_lower = core.lower()
        if core_lower in low:
            w["w"] = w["w"].replace(core, low[core_lower])
        else:
            m = difflib.get_close_matches(core_lower, list(low), n=1, cutoff=0.84)
            if m and core:
                w["w"] = w["w"].replace(core, low[m[0]])
    return words

def run(path: Path, language: str = None):
    """Whisper (faster-whisper) with word-level timestamps + Romanized Hinglish prompt, then glossary + LLM term correction."""
    if not cfg.ENABLE_WHISPER:
        return {"mode": "demo", "words": [], "status": "Whisper is disabled in .env (ENABLE_WHISPER=false)"}
    try:
        from faster_whisper import WhisperModel
        path = Path(path)
        audio_src = audio.extract_wav(path)
        
        # CPU int8 model for fast transcription
        model = WhisperModel(cfg.WHISPER_MODEL, device="cpu", compute_type="int8")
        
        # Roman-script initial prompt primes Whisper for Hinglish code classes
        glossary_str = ", ".join(cfg.GLOSSARY[:30])
        prompt = (
            f"Roman script Hinglish coding tutorial with technical terms: {glossary_str}. "
            "Write speech in Roman alphabet with accurate code keywords."
        )
        
        segs, info = model.transcribe(
            str(audio_src),
            beam_size=1,
            word_timestamps=True,
            vad_filter=True,
            initial_prompt=prompt,
            language=language or None
        )
        
        words = []
        for s in segs:
            if s.words:
                for w in s.words:
                    word_str = w.word.strip()
                    if word_str:
                        words.append({
                            "w": word_str,
                            "s": round(float(w.start), 2),
                            "e": round(float(w.end), 2)
                        })

        if words:
            # Apply fuzzy glossary correction
            words = glossary_fix(words)
            # Apply LLM technical vocabulary correction
            words = llm.fix_words(words)
            detected_lang = getattr(info, "language", "en")
            return {
                "mode": "whisper",
                "words": words,
                "language": detected_lang,
                "total_words": len(words)
            }

        return {"mode": "demo", "words": [], "status": "No speech detected in audio track."}
    except Exception as e:
        print("Whisper transcription warning/error:", e)
        return {"mode": "demo", "words": [], "error": str(e)}

def transcribe_slice(video_path: Path, start: float, end: float, language: str = None) -> list:
    """Quickly transcribe a 30-60 second slice of video using faster-whisper with word timestamps (<1.5s on CPU)."""
    if not cfg.ENABLE_WHISPER:
        return []
    import subprocess
    video_path = Path(video_path)
    temp_wav = cfg.EXPORTS / f"slice_{int(start)}_{int(end)}_{video_path.stem[:8]}.wav"
    try:
        cmd = [
            "ffmpeg", "-y", "-ss", str(start), "-i", str(video_path), "-t", str(end - start),
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(temp_wav)
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if not temp_wav.exists() or temp_wav.stat().st_size < 500:
            return []

        from faster_whisper import WhisperModel
        model = WhisperModel(cfg.WHISPER_MODEL, device="cpu", compute_type="int8")
        glossary_str = ", ".join(cfg.GLOSSARY[:30])
        prompt = (
            f"Roman script Hinglish coding tutorial with technical terms: {glossary_str}. "
            "Write speech in Roman alphabet with accurate code keywords."
        )
        segs, info = model.transcribe(
            str(temp_wav),
            beam_size=1,
            word_timestamps=True,
            vad_filter=True,
            initial_prompt=prompt,
            language=language or None
        )
        words = []
        for s in segs:
            for w in (s.words or []):
                word_str = w.word.strip()
                if word_str:
                    words.append({
                        "w": word_str,
                        "s": round(start + float(w.start), 2),
                        "e": round(start + float(w.end), 2)
                    })
        words = glossary_fix(words)
        return words
    except Exception as e:
        print("Slice transcription warning:", e)
        return []
    finally:
        temp_wav.unlink(missing_ok=True)

