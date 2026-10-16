HDR = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n[V4+ Styles]\n"
 "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n"
 "Style: Default,Arial,64,&H005AB4D8,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,60,60,260,1\n"
 "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n")

def ts(t): return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"

def write_ass(words, start, end, path):
    """Word-by-word karaoke captions (\\k tags) from corrected word timestamps."""
    ws = [w for w in words if start <= w["s"] and w["e"] <= end]; lines = []
    for i in range(0, len(ws), 4):
        g = ws[i:i + 4]
        txt = "".join("{\\k%d}%s " % (max(1, int((w["e"] - w["s"]) * 100)), w["w"]) for w in g)
        s_t = max(0.0, g[0]["s"] - start)
        e_t = max(s_t, g[-1]["e"] - start)
        lines.append(f"Dialogue: 0,{ts(s_t)},{ts(e_t)},Default,,0,0,0,,{txt.strip()}")
    path.write_text(HDR + "\n".join(lines), encoding="utf-8")
