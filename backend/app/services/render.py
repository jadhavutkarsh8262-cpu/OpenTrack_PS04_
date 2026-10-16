import subprocess
from . import reframe, captions

def render(src, words, start, end, out):
    cw, ch, pts = reframe.crop_path(src, start, end)
    x_expr = f"clip({reframe.expr(pts, 1)},0,in_w-out_w)"
    y_expr = f"clip({reframe.expr(pts, 2)},0,in_h-out_h)"
    vf = f"crop={cw}:{ch}:'{x_expr}':'{y_expr}',scale=1080:1920"
    if words:
        ass = out.with_suffix(".ass"); captions.write_ass(words, start, end, ass); vf += f",ass={ass.name}"
    cmd = ["ffmpeg", "-y", "-ss", str(start), "-i", str(src), "-t", str(end - start), "-vf", vf,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", str(out)]
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=out.parent, timeout=900)
    if p.returncode or not out.exists() or out.stat().st_size < 1000:
        raise RuntimeError("FFmpeg failed: " + p.stderr[-600:])
