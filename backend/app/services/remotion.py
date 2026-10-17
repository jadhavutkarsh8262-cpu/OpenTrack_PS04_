import asyncio
import json
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from .. import config as cfg
from . import tts

def render(scenes, title, voice="en-US-ChristopherNeural"):
    """Render Remotion 1080x1920 code animation, synthesize TTS voiceover narration, and multiplex with FFmpeg."""
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx or not (cfg.REMOTION_DIR / "node_modules").exists():
        return {"error": "Remotion not installed. Please run `cd remotion; npm install`."}

    uid = uuid.uuid4().hex[:6]
    timestamp = int(time.time())
    raw_video = cfg.EXPORTS / f"raw_explainer_{timestamp}_{uid}.mp4"
    tts_audio = cfg.EXPORTS / f"voiceover_{timestamp}_{uid}.mp3"
    final_out = cfg.EXPORTS / f"explainer_{timestamp}_{uid}.mp4"
    props_file = cfg.EXPORTS / f"props_{uid}.json"

    try:
        # 1. Synthesize Studio Quality Voiceover
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tts_res = loop.run_until_complete(
                tts.generate_reel_voiceover(scenes, tts_audio, voice=voice)
            )
        finally:
            loop.close()

        # 2. Prepare Remotion Props
        props_file.write_text(
            json.dumps({"title": title, "scenes": scenes}, ensure_ascii=False),
            encoding="utf-8"
        )

        # 3. Render Visual Code Explainer with Remotion
        cmd = [
            npx, "remotion", "render", "src/index.ts", "Explainer",
            str(raw_video.resolve()),
            f"--props={props_file.resolve()}"
        ]
        p = subprocess.run(cmd, cwd=cfg.REMOTION_DIR, capture_output=True, text=True, timeout=900, shell=True)

        if p.returncode != 0 or not raw_video.exists():
            err_msg = p.stderr[-500:] or p.stdout[-500:] or "Remotion visual compilation failed."
            print("Remotion compilation error:", err_msg)
            return {"error": f"Remotion failed: {err_msg}"}

        # 4. Multiplex Remotion Video Track + TTS Voiceover Audio Track with FFmpeg
        if tts_audio.exists() and tts_audio.stat().st_size > 1000:
            mux_cmd = [
                "ffmpeg", "-y",
                "-i", str(raw_video.resolve()),
                "-i", str(tts_audio.resolve()),
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                "-movflags", "+faststart",
                str(final_out.resolve())
            ]
            subprocess.run(mux_cmd, capture_output=True, text=True, timeout=120)

        # Fallback to raw video if multiplexing wasn't needed or failed
        if not final_out.exists() or final_out.stat().st_size < 1000:
            raw_video.rename(final_out)
        else:
            raw_video.unlink(missing_ok=True)

        return {
            "download": f"/api/exports/{final_out.name}",
            "filename": final_out.name,
            "duration": tts_res.get("duration", 45.0)
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

    finally:
        props_file.unlink(missing_ok=True)

