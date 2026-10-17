import os
from pathlib import Path
from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
UPLOADS = ROOT / "storage" / "uploads"; EXPORTS = ROOT / "storage" / "exports"
REMOTION_DIR = ROOT.parent / "remotion"
for p in (UPLOADS, EXPORTS): p.mkdir(parents=True, exist_ok=True)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
ENABLE_WHISPER = os.getenv("ENABLE_WHISPER", "true").lower() == "true"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
TTS_VOICE = os.getenv("TTS_VOICE", "en-US-ChristopherNeural")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
GLOSSARY = [
    "Kubernetes", "useEffect", "useState", "@Autowired", "Spring Boot", "Docker", "JSON", "XML",
    "API", "React", "FastAPI", "GitHub", "async", "await", "npm", "Node.js", "SQL", "Python",
    "TypeScript", "JavaScript", "MongoDB", "PostgreSQL", "Kafka", "Redis", "GraphQL", "PyTorch",
    "Next.js", "Express", "Tailwind", "Git", "REST", "CI/CD", "AWS", "TensorFlow", "Pandas", "NumPy"
]
