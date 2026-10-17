import asyncio
import subprocess
from pathlib import Path
import edge_tts
from .. import config as cfg

VOICES = [
    {"id": "en-US-ChristopherNeural", "name": "Christopher (US Male - Tech / Authority)", "gender": "male", "lang": "en-US"},
    {"id": "en-US-JennyNeural", "name": "Jenny (US Female - Natural / Conversational)", "gender": "female", "lang": "en-US"},
    {"id": "en-IN-PrabhatNeural", "name": "Prabhat (Indian English Male - Ideal for Hinglish / Indian Tech)", "gender": "male", "lang": "en-IN"},
    {"id": "en-IN-NeerjaNeural", "name": "Neerja (Indian English Female - Professional)", "gender": "female", "lang": "en-IN"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia (British English Female - Polished)", "gender": "female", "lang": "en-GB"},
    {"id": "hi-IN-MadhurNeural", "name": "Madhur (Hindi Male)", "gender": "male", "lang": "hi-IN"}
]

def list_voices():
    return VOICES

async def synthesize_text(text: str, out_path: Path, voice: str = None) -> Path:
    """Synthesize text to high-fidelity MP3 audio using edge-tts."""
    v = voice or cfg.TTS_VOICE or "en-US-ChristopherNeural"
    clean_text = text.strip()
    if not clean_text:
        clean_text = "..."
    communicate = edge_tts.Communicate(clean_text, v)
    await communicate.save(str(out_path))
    return out_path

def get_audio_duration(path: Path) -> float:
    """Probe audio duration in seconds via ffprobe."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=30
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0

async def generate_reel_voiceover(scenes: list, out_path: Path, voice: str = None) -> dict:
    """Synthesize speech for each scene narration and concatenate into one master audio track."""
    v = voice or cfg.TTS_VOICE or "en-US-ChristopherNeural"
    export_dir = out_path.parent
    temp_files = []
    scene_durations = []

    for i, sc in enumerate(scenes):
        narration = (sc.get("narration") or sc.get("title") or "").strip()
        if not narration:
            continue
        sc_audio = export_dir / f"scene_{i}_{out_path.stem}.mp3"
        await synthesize_text(narration, sc_audio, v)
        dur = get_audio_duration(sc_audio)
        scene_durations.append({"scene": i, "duration": dur, "file": str(sc_audio)})
        temp_files.append(sc_audio)

    if not temp_files:
        # Fallback short intro
        await synthesize_text("Let's explore this technical concept.", out_path, v)
        return {"file": str(out_path), "duration": get_audio_duration(out_path), "scenes": []}

    # Concatenate scene audio files with FFmpeg
    concat_list = export_dir / f"concat_{out_path.stem}.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for tf in temp_files:
            f.write(f"file '{tf.resolve().as_posix()}'\n")

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "libmp3lame", "-b:a", "192k",
        str(out_path)
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    # Clean up temp files
    try:
        if concat_list.exists(): concat_list.unlink()
        for tf in temp_files:
            if tf.exists(): tf.unlink()
    except Exception:
        pass

    total_dur = get_audio_duration(out_path)
    return {"file": str(out_path), "duration": total_dur, "scenes": scene_durations}
