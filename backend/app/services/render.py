import subprocess
from pathlib import Path
from . import reframe, captions

def render(src, words, start, end, out, brand=None):
    """Render 9:16 vertical video reel with dynamic/anchored reframing and burned karaoke/brand captions."""
    brand = brand or {}
    mode = brand.get("reframe_mode", "smart")
    out = Path(out)
    src = Path(src)

    cw, ch, pts = reframe.crop_path(src, start, end, mode=mode)
    x_expr = f"clip({reframe.expr(pts, 1)},0,in_w-out_w)"
    y_expr = f"clip({reframe.expr(pts, 2)},0,in_h-out_h)"
    vf = f"crop={cw}:{ch}:'{x_expr}':'{y_expr}',scale=1080:1920"

    # If words are not provided or don't cover this clip, transcribe this specific slice on-demand (<1.5s)
    clip_words = [w for w in (words or []) if w.get("e", 0) >= start and w.get("s", 0) <= end]
    if not clip_words:
        try:
            from . import transcribe
            clip_words = transcribe.transcribe_slice(src, start, end)
        except Exception as e:
            print("Render slice transcription warning:", e)

    has_captions = bool(clip_words) or bool(brand.get("header")) or bool(brand.get("handle"))
    if has_captions:
        ass = out.with_suffix(".ass")
        captions.write_ass(clip_words, start, end, ass, brand=brand)
        vf += f",ass={ass.name}"

    cmd = [
        "ffmpeg", "-y", "-ss", str(start), "-i", str(src), "-t", str(end - start),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(out.name)
    ]

    p = subprocess.run(cmd, capture_output=True, text=True, cwd=out.parent, timeout=900)
    if p.returncode != 0 or not out.exists() or out.stat().st_size < 1000:
        print("FFMPEG ERROR STDOUT:", p.stdout)
        print("FFMPEG ERROR STDERR:", p.stderr)
        raise RuntimeError(f"FFmpeg render failed:\n{p.stderr[-400:]}")

