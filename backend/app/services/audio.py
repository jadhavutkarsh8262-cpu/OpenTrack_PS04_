import subprocess
from pathlib import Path

def extract_wav(video_path: Path) -> Path:
    """Extract 16kHz mono PCM WAV audio from video using FFmpeg for optimal Whisper & Librosa processing."""
    video_path = Path(video_path)
    wav_path = video_path.with_suffix(".wav")
    if wav_path.exists() and wav_path.stat().st_size > 1000:
        return wav_path
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(wav_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not wav_path.exists() or wav_path.stat().st_size < 500:
        print(f"Audio extraction warning for {video_path}: {res.stderr[:200]}")
    return wav_path

def get_duration(media_path: Path) -> float:
    """Accurately probe audio or video duration in seconds via ffprobe."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(media_path)],
            capture_output=True, text=True, timeout=30
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0
