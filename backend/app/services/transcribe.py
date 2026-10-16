import difflib
from .. import config as cfg
from . import llm

def glossary_fix(words):
    low = {g.lower(): g for g in cfg.GLOSSARY}
    for w in words:
        core = w["w"].strip(".,?!")
        m = difflib.get_close_matches(core.lower(), list(low), n=1, cutoff=0.82)
        if m and core: w["w"] = w["w"].replace(core, low[m[0]])
    return words

def run(path):
    """Whisper (faster-whisper) with word timestamps + glossary prompt, then glossary + LLM correction."""
    if not cfg.ENABLE_WHISPER: return {"mode": "demo", "words": []}
    from faster_whisper import WhisperModel
    model = WhisperModel(cfg.WHISPER_MODEL, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(path), word_timestamps=True, vad_filter=True,
        initial_prompt="Hinglish coding class in Roman script. Terms: " + ", ".join(cfg.GLOSSARY))
    words = [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)} for s in segs for w in (s.words or [])]
    words = llm.fix_words(glossary_fix(words))
    return {"mode": "whisper", "words": words}
