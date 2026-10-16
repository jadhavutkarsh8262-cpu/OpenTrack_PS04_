import os
from pathlib import Path
from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
UPLOADS = ROOT / "storage" / "uploads"; EXPORTS = ROOT / "storage" / "exports"
REMOTION_DIR = ROOT.parent / "remotion"
for p in (UPLOADS, EXPORTS): p.mkdir(parents=True, exist_ok=True)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")  # server-side only
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
ENABLE_WHISPER = os.getenv("ENABLE_WHISPER", "false").lower() == "true"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
GLOSSARY = ["Kubernetes", "useEffect", "useState", "@Autowired", "Spring Boot", "Docker", "JSON", "XML",
            "API", "React", "FastAPI", "GitHub", "async", "await", "npm", "Node.js", "SQL", "Python"]
