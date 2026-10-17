COLOR_MAP = {
    "gold": "&H005AB4D8",     # #d8b45a (ASS format is &H00BBGGRR)
    "cyan": "&H00D4B606",     # #06b6d4
    "violet": "&H00F755A8",   # #a855f7
    "emerald": "&H0081B910",  # #10b981
    "orange": "&H001673F9",   # #f97316
    "white": "&H00FFFFFF",
}

def ts(t):
    """Format seconds float into ASS timestamp H:MM:SS.cs"""
    t = max(0.0, float(t))
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def get_hdr(accent_color="gold"):
    ass_color = COLOR_MAP.get(str(accent_color).lower(), "&H005AB4D8")
    return (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n[V4+ Styles]\n"
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n"
        f"Style: Default,Arial,64,{ass_color},&H00FFFFFF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,4,2,2,60,60,260,1\n"
        f"Style: Clean,Arial,60,&H00FFFFFF,{ass_color},&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,3,2,2,60,60,260,1\n"
        f"Style: Banner,Arial,42,&H00FFFFFF,{ass_color},&H00000000,&HA0000000,1,0,0,0,100,100,0,0,1,3,1,8,60,60,110,1\n"
        f"Style: Brand,Arial,36,{ass_color},&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,0,0,1,2,1,9,60,60,90,1\n"
        "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
    )

def write_ass(words, start, end, path, brand=None):
    """Write SSA/ASS subtitle file with karaoke (\\k tags) or clean style, plus top banner and watermark."""
    brand = brand or {}
    accent = brand.get("color", "gold")
    caption_style = brand.get("style", "karaoke")
    hdr = get_hdr(accent)
    lines = []
    
    total_len = max(0.5, end - start)

    # 1. Top banner / Hook badge
    if brand.get("header"):
        lines.append(f"Dialogue: 0,{ts(0)},{ts(total_len)},Banner,,0,0,0,,{brand['header']}")

    # 2. Creator watermark / handle
    if brand.get("handle"):
        lines.append(f"Dialogue: 0,{ts(0)},{ts(total_len)},Brand,,0,0,0,,{brand['handle']}")

    # 3. Synchronized speech subtitles
    ws = [w for w in words if w.get("e", 0) >= start and w.get("s", 0) <= end]
    
    chunk_size = 3 if caption_style == "karaoke" else 4
    for i in range(0, len(ws), chunk_size):
        g = ws[i:i + chunk_size]
        if not g:
            continue
        s_t = max(0.0, g[0]["s"] - start)
        e_t = max(s_t + 0.3, g[-1]["e"] - start)

        if caption_style == "karaoke":
            # Word-by-word karaoke highlight
            txt_parts = []
            for w in g:
                dur_cs = max(1, int((w["e"] - w["s"]) * 100))
                txt_parts.append(f"{{\\k{dur_cs}}}{w['w']}")
            txt = " ".join(txt_parts)
            lines.append(f"Dialogue: 0,{ts(s_t)},{ts(e_t)},Default,,0,0,0,,{txt.strip()}")
        else:
            txt = " ".join(w["w"] for w in g)
            lines.append(f"Dialogue: 0,{ts(s_t)},{ts(e_t)},Clean,,0,0,0,,{txt.strip()}")

    path.write_text(hdr + "\n".join(lines), encoding="utf-8")

