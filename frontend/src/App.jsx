import { useState, useEffect, useRef } from "react";

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes("127.0.0.1") && !envUrl.includes("localhost")) {
    return envUrl;
  }
  return "";
};
const API = getApiBase();

const j = async (path, opts) => {
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || "Request failed");
  return data;
};

const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s < 10 ? "0" : ""}${s}.${ms}`;
};

const BRAND_COLORS = [
  { id: "gold", name: "Imperial Gold", hex: "#e5bf70" },
  { id: "cyan", name: "Cyber Cyan", hex: "#06b6d4" },
  { id: "violet", name: "Electric Violet", hex: "#a855f7" },
  { id: "emerald", name: "Matrix Emerald", hex: "#10b981" },
  { id: "orange", name: "Neon Sunset", hex: "#f97316" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("mode1");
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Mode 1 state
  const [project, setProject] = useState(null);
  const [projectsList, setProjectsList] = useState([]);
  const [range, setRange] = useState({ start: 0, end: 45 });
  const [downloadUrl, setDownloadUrl] = useState("");
  const [renderFilename, setRenderFilename] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isPlayingRange, setIsPlayingRange] = useState(false);
  const fileInputRef = useRef(null);
  const sourceVideoRef = useRef(null);

  // Slicing & batch render state
  const [splitStrategy, setSplitStrategy] = useState("highlights"); // "highlights" or "continuous"
  const [splitChunkLen, setSplitChunkLen] = useState(45);
  const [splitNumClips, setSplitNumClips] = useState(6);
  const [exportedReels, setExportedReels] = useState([]);
  const [batchProgress, setBatchProgress] = useState(null);
  const [renderingClipIdx, setRenderingClipIdx] = useState(null);

  // Branding & Reframing options
  const [brandHeader, setBrandHeader] = useState("");
  const [brandHandle, setBrandHandle] = useState("");
  const [brandColor, setBrandColor] = useState("gold");
  const [reframeMode, setReframeMode] = useState("smart"); // "smart", "center", "left", "right"
  const [captionStyle, setCaptionStyle] = useState("karaoke"); // "karaoke", "clean"

  // Mode 2 state
  const [topic, setTopic] = useState("Python Async / Await");
  const [topicResult, setTopicResult] = useState(null);
  const [remotionDownload, setRemotionDownload] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("en-US-ChristopherNeural");
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const voiceAudioRef = useRef(null);

  // Status & errors
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const checkHealth = async () => {
    try {
      setLoadingHealth(true);
      const data = await j("/api/health");
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadVoices = async () => {
    try {
      const data = await j("/api/voices");
      if (Array.isArray(data) && data.length > 0) {
        setVoices(data);
      }
    } catch {
      setVoices([
        { id: "en-US-ChristopherNeural", name: "Christopher (US Male - Tech / Authority)", lang: "en-US" },
        { id: "en-US-JennyNeural", name: "Jenny (US Female - Natural / Conversational)", lang: "en-US" },
        { id: "en-IN-PrabhatNeural", name: "Prabhat (Indian English Male - Hinglish)", lang: "en-IN" },
        { id: "en-IN-NeerjaNeural", name: "Neerja (Indian English Female - Professional)", lang: "en-IN" },
        { id: "en-GB-SoniaNeural", name: "Sonia (British English Female)", lang: "en-GB" },
        { id: "hi-IN-MadhurNeural", name: "Madhur (Hindi Male)", lang: "hi-IN" }
      ]);
    }
  };

  const loadProjects = async (autoSelectLatest = false) => {
    try {
      const list = await j("/api/projects");
      if (Array.isArray(list)) {
        setProjectsList(list);
        if (autoSelectLatest && list.length > 0) {
          loadProjectById(list[0].id);
        }
      }
    } catch (e) {
      console.warn("Could not list projects", e);
    }
  };

  const loadProjectById = async (pid) => {
    const execute = runAsync("Loading video project…", async () => {
      const data = await j(`/api/projects/${pid}`);
      setProject(data);
      const dur = data.duration || 60;
      if (data.clips && data.clips.length > 0) {
        setRange({ start: data.clips[0].start, end: data.clips[0].end });
      } else {
        setRange({ start: 0, end: Math.min(dur, 45) });
      }
      setSuccess(`Loaded "${data.name || data.file}" (${Math.round(dur)}s, ${data.clips?.length || 0} candidate reels).`);
    });
    execute();
  };

  useEffect(() => {
    checkHealth();
    loadVoices();
    loadProjects(true);
  }, []);

  const runAsync = (msg, fn) => async (...args) => {
    setBusy(true);
    setBusyMessage(msg);
    setError("");
    setSuccess("");
    try {
      await fn(...args);
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  };

  // Video timeupdate boundary listener
  const handleVideoTimeUpdate = () => {
    if (isPlayingRange && sourceVideoRef.current) {
      if (sourceVideoRef.current.currentTime >= range.end) {
        sourceVideoRef.current.pause();
        setIsPlayingRange(false);
      }
    }
  };

  // Play clip preview
  const handlePlayClipRange = () => {
    if (!sourceVideoRef.current) return;
    sourceVideoRef.current.currentTime = Math.max(0, range.start);
    sourceVideoRef.current.play();
    setIsPlayingRange(true);
  };

  const handleStopClipRange = () => {
    if (sourceVideoRef.current) {
      sourceVideoRef.current.pause();
    }
    setIsPlayingRange(false);
  };

  // Upload handler
  const handleUploadFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["mp4", "mov", "webm"].includes(ext)) {
      setError("Please select an MP4, MOV, or WebM video file.");
      return;
    }
    const execute = runAsync("Uploading, extracting audio & scanning video…", async () => {
      const fd = new FormData();
      fd.append("video", file);
      const data = await j("/api/upload", { method: "POST", body: fd });
      setProject(data);
      const dur = data.duration || 45;
      setRange({ start: 0, end: Math.min(dur, 45) });
      setDownloadUrl("");
      setSuccess(`Uploaded "${file.name}" (${Math.round(dur)}s). Audio extracted and ready.`);
      loadProjects(false);
    });
    execute();
  };

  // Mode 1: Analyze
  const handleAnalyze = runAsync("Running Whisper speech-to-text, Librosa energy & OpenCV scene analysis…", async () => {
    if (!project) return;
    const data = await j(`/api/projects/${project.id}/analyze`, { method: "POST" });
    setProject(data);
    if (data.clips && data.clips.length > 0) {
      setRange({ start: data.clips[0].start, end: data.clips[0].end });
    }
    setSuccess(
      data.mode === "whisper"
        ? `Analysis complete! Transcribed ${data.words?.length || 0} words with word-level timestamps and generated sentence-aligned clips.`
        : "Analysis complete in demo mode (Set ENABLE_WHISPER=true in backend .env for full Whisper AI transcription)."
    );
  });

  // Re-split / generate reels from full long video
  const handleSplitClips = runAsync("Re-slicing full long video into short vertical reels…", async () => {
    if (!project) return;
    const body = {
      strategy: splitStrategy,
      chunk_len: +splitChunkLen,
      num_clips: +splitNumClips
    };
    const data = await j(`/api/projects/${project.id}/split`, post(body));
    setProject(data);
    if (data.clips && data.clips.length > 0) {
      setRange({ start: data.clips[0].start, end: data.clips[0].end });
    }
    setSuccess(`Generated ${data.clips?.length || 0} short reels across the full ${Math.round(data.duration || 0)}s video!`);
  });

  // Render a specific clip card directly
  const handleRenderSpecificClip = async (clip, idx) => {
    if (!project) return;
    setRenderingClipIdx(idx);
    setError("");
    try {
      const brandPayload = {
        header: brandHeader.trim(),
        handle: brandHandle.trim(),
        color: brandColor,
        style: captionStyle,
        reframe_mode: reframeMode
      };
      const data = await j(`/api/projects/${project.id}/render`, post({
        start: clip.start,
        end: clip.end,
        title: clip.title,
        brand: brandPayload
      }));
      const newReel = {
        title: clip.title,
        start: clip.start,
        end: clip.end,
        duration: (clip.end - clip.start).toFixed(1),
        download: API + data.download,
        filename: data.filename
      };
      setExportedReels(prev => [newReel, ...prev]);
      setDownloadUrl(API + data.download);
      setRenderFilename(data.filename);
      setSuccess(`Rendered "${clip.title}"! Scroll down to view in Exported Reels Gallery.`);
    } catch (err) {
      setError(err.message || "Failed to render clip.");
    } finally {
      setRenderingClipIdx(null);
    }
  };

  // Batch render all candidate reels covering the full video
  const handleBatchRenderAll = async () => {
    if (!project || !project.clips || project.clips.length === 0) return;
    setBusy(true);
    setError("");
    const total = project.clips.length;
    const brandPayload = {
      header: brandHeader.trim(),
      handle: brandHandle.trim(),
      color: brandColor,
      style: captionStyle,
      reframe_mode: reframeMode
    };

    const renderedList = [];
    for (let i = 0; i < total; i++) {
      const clip = project.clips[i];
      setBusyMessage(`Rendering Reel ${i + 1} of ${total}: "${clip.title}"…`);
      setBatchProgress({ current: i + 1, total, title: clip.title });
      try {
        const data = await j(`/api/projects/${project.id}/render`, post({
          start: clip.start,
          end: clip.end,
          title: clip.title,
          brand: brandPayload
        }));
        const newReel = {
          title: clip.title,
          start: clip.start,
          end: clip.end,
          duration: (clip.end - clip.start).toFixed(1),
          download: API + data.download,
          filename: data.filename
        };
        renderedList.push(newReel);
        setExportedReels(prev => [newReel, ...prev]);
      } catch (err) {
        console.error(`Failed to render reel ${i + 1}:`, err);
      }
    }
    setBusy(false);
    setBusyMessage("");
    setBatchProgress(null);
    if (renderedList.length > 0) {
      setSuccess(`Successfully exported ${renderedList.length} of ${total} reels covering the entire video! Check the gallery below.`);
    } else {
      setError("Batch export completed with errors.");
    }
  };

  // Mode 1: Render Single
  const handleRender = runAsync("Reframing to 9:16, tracking active code, burning karaoke captions & exporting…", async () => {
    if (!project) return;
    const s = Math.max(0, +range.start);
    const e = Math.min(project.duration || 9999, +range.end);
    if (e <= s) {
      throw new Error("End timestamp must be greater than start timestamp.");
    }
    if (e - s > 180) {
      throw new Error("Maximum reel duration is 3 minutes (180s). Please select a clip up to 180 seconds.");
    }

    const brandPayload = {
      header: brandHeader.trim(),
      handle: brandHandle.trim(),
      color: brandColor,
      style: captionStyle,
      reframe_mode: reframeMode
    };

    const currentTitle = project.clips?.find(c => Math.abs(c.start - s) < 1.0 && Math.abs(c.end - e) < 1.0)?.title
      || `Reel (${formatTime(s)} - ${formatTime(e)})`;

    const data = await j(`/api/projects/${project.id}/render`, post({ start: s, end: e, title: currentTitle, brand: brandPayload }));
    setDownloadUrl(API + data.download);
    setRenderFilename(data.filename || "reel.mp4");
    const newReel = {
      title: currentTitle,
      start: s,
      end: e,
      duration: (e - s).toFixed(1),
      download: API + data.download,
      filename: data.filename
    };
    setExportedReels(prev => [newReel, ...prev]);
    setSuccess("Reel rendered successfully! Preview your 9:16 vertical video below.");
  });

  // Mode 2: Generate Script
  const handleGenerateScript = runAsync("Synthesizing 4-scene technical script & code examples…", async () => {
    const data = await j("/api/topic-video", post({ topic, render: false }));
    setTopicResult(data);
    setRemotionDownload("");
    setSuccess(`Generated 4-scene script via ${data.mode === "llm" ? "LLM API" : "Educational Storyboard Engine"}. You can edit any scene below!`);
  });

  // Mode 2: Edit Scene
  const handleSceneChange = (index, field, value) => {
    if (!topicResult || !topicResult.scenes) return;
    const updated = [...topicResult.scenes];
    updated[index] = { ...updated[index], [field]: value };
    setTopicResult({ ...topicResult, scenes: updated });
  };

  // Mode 2: Preview Voice
  const handlePreviewVoice = async () => {
    setPreviewingVoice(true);
    try {
      const data = await j("/api/tts-preview", post({
        text: `Welcome to Reel Studio. Here is your preview for ${topic}.`,
        voice: selectedVoice
      }));
      if (voiceAudioRef.current) {
        voiceAudioRef.current.src = API + data.audio_url;
        voiceAudioRef.current.play();
      }
    } catch (err) {
      setError(err.message || "Failed to preview voice.");
    } finally {
      setPreviewingVoice(false);
    }
  };

  // Mode 2: Render Explainer Video
  const handleRenderExplainer = runAsync("Synthesizing AI voiceover narration & compiling Remotion 60fps vertical reel…", async () => {
    const data = await j("/api/topic-video", post({
      topic,
      render: true,
      voice: selectedVoice,
      scenes: topicResult?.scenes
    }));
    setTopicResult(data);
    if (data.error) {
      throw new Error(`Render error: ${data.error}`);
    }
    if (data.download) {
      setRemotionDownload(API + data.download);
      setSuccess("Remotion explainer reel rendered with full studio AI voiceover narration!");
    }
  });

  const duration = project?.duration || 60;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 80px" }}>
      {/* Hidden audio element for TTS preview */}
      <audio ref={voiceAudioRef} style={{ display: "none" }} />

      {/* Header bar */}
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>⚡</span>
              <h1 style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #fce09b 0%, #e5bf70 50%, #c49a3f 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>
                KURUKSHETRA Reel Studio
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(229, 191, 112, 0.15)",
                color: "#e5bf70",
                border: "1px solid rgba(229, 191, 112, 0.3)",
                padding: "3px 8px",
                borderRadius: 6
              }}>
                OP-04
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
              Intelligent Vertical Video Reframing, Hinglish Transcription & Remotion Motion Explainer Suite
            </p>
          </div>

          {/* System status pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={`badge ${health ? "badge-active" : "badge-inactive"}`}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: health ? "#34d399" : "#f43f5e" }} />
              API: {loadingHealth ? "Checking…" : health ? "Connected" : "Offline"}
            </span>
            <span className={`badge ${health?.ffmpeg ? "badge-active" : "badge-inactive"}`}>
              FFmpeg: {health?.ffmpeg ? "Ready" : "Missing"}
            </span>
            <span className={`badge ${health?.whisper ? "badge-active" : "badge-inactive"}`}>
              Whisper: {health?.whisper ? `AI (${health.whisper_model || "tiny"})` : "Demo Mode"}
            </span>
            <span className={`badge ${health?.llm ? "badge-active" : "badge-inactive"}`}>
              LLM: {health?.llm ? `Active (${health.llm_provider})` : "Heuristic"}
            </span>
            <span className={`badge ${health?.tts ? "badge-active" : "badge-inactive"}`}>
              TTS Voice: Active
            </span>
            <span className={`badge ${health?.remotion ? "badge-active" : "badge-inactive"}`}>
              Remotion: {health?.remotion ? "Ready" : "Standby"}
            </span>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div style={{
          background: "rgba(244, 63, 94, 0.12)",
          border: "1px solid rgba(244, 63, 94, 0.3)",
          color: "#fca5a5",
          padding: "14px 18px",
          borderRadius: "var(--radius-md)",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{error}</span>
          </div>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
      )}

      {success && (
        <div style={{
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "#6ee7b7",
          padding: "14px 18px",
          borderRadius: "var(--radius-md)",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", color: "#6ee7b7", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div style={{
        display: "flex",
        gap: 8,
        background: "rgba(16, 14, 26, 0.8)",
        padding: 6,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        marginBottom: 24
      }}>
        <button
          onClick={() => setActiveTab("mode1")}
          style={{
            flex: 1,
            padding: "12px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: activeTab === "mode1" ? "var(--bg-surface-hover)" : "transparent",
            color: activeTab === "mode1" ? "var(--accent-gold)" : "var(--text-muted)",
            boxShadow: activeTab === "mode1" ? "0 4px 12px rgba(0,0,0,0.3)" : "none"
          }}
        >
          <span>🎬</span> Mode 1: Class Recording → 9:16 Vertical Reel
        </button>
        <button
          onClick={() => setActiveTab("mode2")}
          style={{
            flex: 1,
            padding: "12px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: activeTab === "mode2" ? "var(--bg-surface-hover)" : "transparent",
            color: activeTab === "mode2" ? "var(--accent-violet)" : "var(--text-muted)",
            boxShadow: activeTab === "mode2" ? "0 4px 12px rgba(0,0,0,0.3)" : "none"
          }}
        >
          <span>✨</span> Mode 2: Topic → Motion Explainer Reel (Remotion + Voiceover)
        </button>
      </div>

      {/* MODE 1 CONTENT */}
      {activeTab === "mode1" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Upload card */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📁</span> Step 1: Upload Source Recording
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
              Supports MP4, MOV, or WebM lecture and coding recordings. Automatically extracts audio, detects Hinglish speech timestamps, and tracks screen focus.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/webm"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
            />

            <div
              className={`dropzone ${dragActive ? "drag-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>📼</div>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                {project ? `Selected: ${project.name}` : "Click or drag & drop video file here"}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
                MP4, MOV, WebM • Screen recordings, tutorials, or webinars
              </p>
            </div>

            {/* Previously Uploaded Projects Selector */}
            {projectsList.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    📂 Or Choose from Previously Uploaded Videos:
                  </label>
                  <span style={{ fontSize: 11, color: "var(--accent-gold)" }}>{projectsList.length} saved project{projectsList.length > 1 ? "s" : ""}</span>
                </div>
                <select
                  className="text-input"
                  value={project?.id || ""}
                  onChange={(e) => {
                    if (e.target.value) loadProjectById(e.target.value);
                  }}
                  style={{
                    cursor: "pointer",
                    background: "rgba(16, 14, 26, 0.9)",
                    border: "1px solid rgba(229, 191, 112, 0.4)",
                    color: "var(--text-main)"
                  }}
                >
                  <option value="" disabled>-- Select a recent video project --</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({Math.round(p.duration)}s • {p.clips_count} reels{p.has_words ? " • Transcribed" : ""})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Project Details, Analysis & Editing */}
          {project && (
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🔍</span> Step 2: Speech, Moments & Clip Selection
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                    File: <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{project.name}</span> • Duration: <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>{formatTime(duration)}</span>
                  </p>
                </div>
                <button
                  className="btn btn-gold"
                  disabled={busy}
                  onClick={handleAnalyze}
                >
                  {busy ? <><span className="spinner" /> {busyMessage}</> : <><span>⚡</span> Analyze Recording</>}
                </button>
              </div>

              {/* Source Video Preview with Clip Bounds Sync */}
              {project.url && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                      Source Video Preview (Synchronized with timeline):
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "5px 12px", fontSize: 12 }}
                        onClick={isPlayingRange ? handleStopClipRange : handlePlayClipRange}
                      >
                        {isPlayingRange ? "⏸️ Pause Preview" : `▶️ Play Clip (${(range.end - range.start).toFixed(1)}s)`}
                      </button>
                    </div>
                  </div>
                  <video
                    ref={sourceVideoRef}
                    controls
                    onTimeUpdate={handleVideoTimeUpdate}
                    src={API + project.url}
                    style={{
                      width: "100%",
                      maxHeight: 280,
                      borderRadius: "var(--radius-md)",
                      background: "#000",
                      border: "1px solid var(--border-subtle)"
                    }}
                  />
                </div>
              )}

              {/* Full Video Slicing & Partitioning Controls */}
              <div style={{
                background: "rgba(25, 20, 42, 0.75)",
                border: "1px solid rgba(139, 92, 246, 0.35)",
                borderRadius: "var(--radius-md)",
                padding: "18px 20px",
                marginBottom: 20
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e5bf70", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>✂️</span> Cut Full Long Video into Vertical Shorts ({formatTime(duration)} total)
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Convert the entire recording into 30–60s reels: choose AI smart highlights across the timeline or sequential continuous parts.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, borderColor: "var(--accent-gold)", color: "var(--accent-gold)" }}
                      onClick={handleSplitClips}
                      disabled={busy}
                    >
                      ⚡ Re-Cut Long Video
                    </button>
                    <button
                      className="btn btn-gold"
                      style={{ padding: "7px 16px", fontSize: 12, fontWeight: 700 }}
                      onClick={handleBatchRenderAll}
                      disabled={busy}
                    >
                      🚀 Batch Export All ({project.clips?.length || 0}) Reels
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
                      Slicing Strategy:
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSplitStrategy("highlights")}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          background: splitStrategy === "highlights" ? "rgba(229, 191, 112, 0.25)" : "rgba(255, 255, 255, 0.05)",
                          border: `1px solid ${splitStrategy === "highlights" ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                          color: splitStrategy === "highlights" ? "var(--accent-gold)" : "var(--text-muted)"
                        }}
                      >
                        🎯 AI Highlights
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitStrategy("continuous")}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          background: splitStrategy === "continuous" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                          border: `1px solid ${splitStrategy === "continuous" ? "var(--accent-violet)" : "var(--border-subtle)"}`,
                          color: splitStrategy === "continuous" ? "#c4b5fd" : "var(--text-muted)"
                        }}
                      >
                        ✂️ Continuous Parts
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
                      Reel Target Duration:
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[30, 45, 60].map(sec => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setSplitChunkLen(sec)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: splitChunkLen === sec ? "rgba(229, 191, 112, 0.2)" : "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${splitChunkLen === sec ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                            color: splitChunkLen === sec ? "var(--accent-gold)" : "var(--text-muted)"
                          }}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {splitStrategy === "highlights" && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
                        Highlight Count Across Timeline:
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[4, 6, 8, 10].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSplitNumClips(cnt)}
                            style={{
                              flex: 1,
                              padding: "6px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              background: splitNumClips === cnt ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                              border: `1px solid ${splitNumClips === cnt ? "var(--accent-violet)" : "var(--border-subtle)"}`,
                              color: splitNumClips === cnt ? "#c4b5fd" : "var(--text-muted)"
                            }}
                          >
                            {cnt} Reels
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Progress Bar if active */}
                {batchProgress && (
                  <div style={{ marginTop: 14, background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 8, border: "1px solid rgba(229, 191, 112, 0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "var(--accent-gold)" }}>
                        Rendering Reel {batchProgress.current} of {batchProgress.total}…
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>{batchProgress.title}</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--accent-gold), var(--accent-violet))",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* AI Candidate Highlights */}
              {project.clips && project.clips.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-gold)" }}>
                      🎯 Candidate 30–60s Reels Covering Full Long Video ({project.clips.length} reels generated):
                    </p>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      Engine: {project.mode === "whisper" ? "Whisper Hinglish AI + Librosa" : "Scene & Pitch Heuristic"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                    {project.clips.map((clip, idx) => {
                      const isSelected = Math.abs(range.start - clip.start) < 0.2 && Math.abs(range.end - clip.end) < 0.2;
                      const isRenderingThis = renderingClipIdx === idx;
                      return (
                        <div
                          key={idx}
                          style={{
                            background: isSelected ? "rgba(229, 191, 112, 0.12)" : "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${isSelected ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                            borderRadius: "var(--radius-md)",
                            padding: "14px 16px",
                            transition: "all 0.2s ease",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "var(--accent-gold)" : "#fff" }}>
                                {clip.title}
                              </span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: "rgba(139, 92, 246, 0.2)",
                                color: "#c4b5fd",
                                padding: "2px 6px",
                                borderRadius: 4
                              }}>
                                Score: {clip.score}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                              📍 {formatTime(clip.start)} → {formatTime(clip.end)} ({Math.round(clip.end - clip.start)}s)
                            </p>
                            <p style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4, marginBottom: 10 }}>
                              {clip.reason}
                            </p>
                          </div>

                          <div style={{ display: "flex", gap: 6, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "4px 8px", fontSize: 11, flex: 1 }}
                              onClick={() => {
                                setRange({ start: clip.start, end: clip.end });
                                if (sourceVideoRef.current) {
                                  sourceVideoRef.current.currentTime = clip.start;
                                  sourceVideoRef.current.play();
                                  setIsPlayingRange(true);
                                }
                              }}
                            >
                              ▶️ Preview
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "4px 8px", fontSize: 11, flex: 1 }}
                              onClick={() => setRange({ start: clip.start, end: clip.end })}
                            >
                              🎯 Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-gold"
                              style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, flex: 1.2 }}
                              disabled={busy || isRenderingThis}
                              onClick={() => handleRenderSpecificClip(clip, idx)}
                            >
                              {isRenderingThis ? "⏳ Rendering…" : "🎬 Render Reel"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Editable Clip Boundaries & Timeline Scrubber */}
              <div style={{ marginTop: 12, marginBottom: 28, background: "rgba(16, 14, 26, 0.5)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                    ⏱️ Editable Clip Boundaries
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Start (s):</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={duration}
                        className="num-input"
                        value={Math.round(range.start * 10) / 10}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(+e.target.value, range.end - 1));
                          setRange({ ...range, start: val });
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>End (s):</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max={duration}
                        className="num-input"
                        value={Math.round(range.end * 10) / 10}
                        onChange={(e) => {
                          const val = Math.min(duration, Math.max(+e.target.value, range.start + 1));
                          setRange({ ...range, end: val });
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--accent-gold)",
                      background: "rgba(229, 191, 112, 0.15)",
                      padding: "4px 10px",
                      borderRadius: 6
                    }}>
                      Duration: {Math.max(0, range.end - range.start).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Timeline bar with candidate blocks */}
                <div className="timeline-track" style={{ marginBottom: 14 }}>
                  {project.clips?.map((c, i) => (
                    <div
                      key={i}
                      title={`${c.title} (${formatTime(c.start)} - ${formatTime(c.end)})`}
                      onClick={() => setRange({ start: c.start, end: c.end })}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${(c.start / duration) * 100}%`,
                        width: `${Math.max(1, ((c.end - c.start) / duration) * 100)}%`,
                        background: "rgba(139, 92, 246, 0.45)",
                        borderLeft: "2px solid #a78bfa",
                        cursor: "pointer",
                        transition: "opacity 0.2s"
                      }}
                    />
                  ))}
                  {/* Active selection */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${(range.start / duration) * 100}%`,
                      width: `${Math.max(0.5, ((range.end - range.start) / duration) * 100)}%`,
                      background: "rgba(229, 191, 112, 0.35)",
                      border: "2px solid var(--accent-gold)",
                      borderRadius: 4,
                      pointerEvents: "none"
                    }}
                  />
                </div>

                {/* Range Sliders */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Start Scrub</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-gold)" }}>{formatTime(range.start)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.5"
                      value={range.start}
                      onChange={(e) => {
                        const val = Math.min(+e.target.value, +range.end - 1);
                        setRange({ ...range, start: Math.max(0, val) });
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>End Scrub</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-gold)" }}>{formatTime(range.end)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.5"
                      value={range.end}
                      onChange={(e) => {
                        const val = Math.max(+e.target.value, +range.start + 1);
                        setRange({ ...range, end: Math.min(duration, val) });
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Branding, Styling & Smart Reframing Controls */}
              <div style={{
                background: "rgba(20, 18, 30, 0.8)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: 20,
                marginBottom: 24
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🎨</span> Step 3: Branding & Reframing Customization
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      Top Hook / Topic Banner:
                    </label>
                    <input
                      className="text-input"
                      placeholder="e.g. ⚡ MASTER PYTHON ASYNC"
                      value={brandHeader}
                      onChange={(e) => setBrandHeader(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      Creator Watermark / Handle:
                    </label>
                    <input
                      className="text-input"
                      placeholder="e.g. @codewithraj"
                      value={brandHandle}
                      onChange={(e) => setBrandHandle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      Accent Color Theme:
                    </label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                      {BRAND_COLORS.map((bc) => (
                        <div
                          key={bc.id}
                          title={bc.name}
                          onClick={() => setBrandColor(bc.id)}
                          className={`color-swatch ${brandColor === bc.id ? "active" : ""}`}
                          style={{ background: bc.hex }}
                        >
                          {brandColor === bc.id && <span style={{ color: "#000", fontSize: 14, fontWeight: 900 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reframing Mode & Caption Style */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      9:16 Reframing Camera Focus:
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { id: "smart", label: "🎯 Smart Motion / Code Track" },
                        { id: "left", label: "💻 Left Code Focus" },
                        { id: "center", label: "⚖️ Center 9:16" },
                        { id: "right", label: "🖥️ Right Preview" }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setReframeMode(m.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: reframeMode === m.id ? "rgba(229, 191, 112, 0.2)" : "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${reframeMode === m.id ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                            color: reframeMode === m.id ? "var(--accent-gold)" : "var(--text-muted)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      Caption Animation Style:
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[
                        { id: "karaoke", label: "🎤 Word-by-Word Karaoke Glow" },
                        { id: "clean", label: "📄 Clean Modern Subtitles" }
                      ].map((cs) => (
                        <button
                          key={cs.id}
                          type="button"
                          onClick={() => setCaptionStyle(cs.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: captionStyle === cs.id ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${captionStyle === cs.id ? "var(--accent-violet)" : "var(--border-subtle)"}`,
                            color: captionStyle === cs.id ? "#c4b5fd" : "var(--text-muted)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {cs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Render Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  className="btn btn-gold"
                  style={{ padding: "12px 24px", fontSize: 15, fontWeight: 700 }}
                  disabled={busy}
                  onClick={handleRender}
                >
                  {busy && !batchProgress ? <><span className="spinner" /> {busyMessage}</> : <><span>🎬</span> Render Selected Reel ({(range.end - range.start).toFixed(1)}s)</>}
                </button>

                <button
                  className="btn btn-secondary"
                  style={{
                    padding: "12px 22px",
                    fontSize: 14,
                    fontWeight: 700,
                    borderColor: "var(--accent-violet)",
                    color: "#c4b5fd",
                    background: "rgba(139, 92, 246, 0.15)"
                  }}
                  disabled={busy || !project.clips || project.clips.length === 0}
                  onClick={handleBatchRenderAll}
                >
                  {batchProgress ? (
                    <><span className="spinner" /> {busyMessage}</>
                  ) : (
                    <><span>🚀</span> Batch Export All ({project.clips?.length || 0}) Reels Across Long Video</>
                  )}
                </button>

                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Generates 1080×1920 MP4 vertical reels with dynamic focus panning, branding watermark & burned captions
                </span>
              </div>

              {/* Latest Render Download / Preview Section */}
              {downloadUrl && (
                <div style={{
                  marginTop: 24,
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: "var(--radius-md)",
                  padding: 20
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>✨</span> Latest Render Complete!
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{renderFilename}</p>
                    </div>
                    <a
                      href={downloadUrl}
                      download={renderFilename}
                      className="btn btn-emerald"
                      style={{ padding: "10px 20px", fontWeight: 700 }}
                    >
                      <span>⬇️</span> Download Reel (.mp4)
                    </a>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <video
                      controls
                      src={downloadUrl}
                      style={{
                        maxHeight: 460,
                        aspectRatio: "9/16",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                        border: "1px solid var(--border-subtle)",
                        background: "#000"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Exported 9:16 Vertical Reels Gallery */}
              {exportedReels.length > 0 && (
                <div style={{
                  marginTop: 28,
                  padding: 24,
                  background: "rgba(18, 15, 30, 0.8)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(229, 191, 112, 0.3)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--accent-gold)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🎬</span> Exported 9:16 Vertical Reels Gallery ({exportedReels.length} Reel{exportedReels.length > 1 ? "s" : ""} Exported)
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        All short vertical reels generated from your full recording. Preview, play with burned captions, or download anytime.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 18
                  }}>
                    {exportedReels.map((reel, rIdx) => (
                      <div
                        key={rIdx}
                        style={{
                          background: "rgba(10, 8, 20, 0.8)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          padding: 16,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", display: "block" }}>
                              {reel.title}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {formatTime(reel.start)} → {formatTime(reel.end)} ({reel.duration}s)
                            </span>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: "rgba(16, 185, 129, 0.2)",
                            color: "#6ee7b7",
                            padding: "2px 6px",
                            borderRadius: 4
                          }}>
                            9:16 Ready
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", background: "#000", borderRadius: 8, overflow: "hidden" }}>
                          <video
                            controls
                            src={reel.download}
                            style={{
                              width: "100%",
                              maxHeight: 380,
                              aspectRatio: "9/16",
                              objectFit: "contain"
                            }}
                          />
                        </div>

                        <a
                          href={reel.download}
                          download={reel.filename}
                          className="btn btn-emerald"
                          style={{
                            padding: "8px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: "center",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6
                          }}
                        >
                          <span>⬇️</span> Download Reel ({reel.duration}s MP4)
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2 CONTENT */}
      {activeTab === "mode2" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span>💡</span> Topic to Animated Code Explainer Reel
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>
              Generate structured 4-scene vertical reels with AI-written scripts, synchronized studio AI voiceovers, typing syntax animations, and karaoke captions (1080×1920 60fps).
            </p>

            {/* Quick Topic Chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "var(--text-dim)", alignSelf: "center" }}>Suggestions:</span>
              {[
                "Python Async / Await",
                "React useEffect vs useState",
                "Docker Containers vs VMs",
                "REST API vs GraphQL",
                "Kubernetes Pod Lifecycle"
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  style={{
                    background: topic === t ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    border: `1px solid ${topic === t ? "var(--accent-violet)" : "var(--border-subtle)"}`,
                    color: topic === t ? "#c4b5fd" : "var(--text-muted)",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Topic Input */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <input
                className="text-input"
                style={{ flex: 1, minWidth: 260 }}
                placeholder="Enter topic or question, e.g. 'How Kafka message queues work'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                disabled={busy || !topic.trim()}
                onClick={handleGenerateScript}
              >
                {busy && busyMessage.includes("script") ? <><span className="spinner" /> Generating…</> : <><span>📝</span> Generate Script</>}
              </button>
              <button
                className="btn btn-violet"
                disabled={busy || !topic.trim()}
                onClick={handleRenderExplainer}
              >
                {busy && busyMessage.includes("narration") ? <><span className="spinner" /> Rendering…</> : <><span>✨</span> Generate & Render Reel</>}
              </button>
            </div>

            {/* Voiceover Engine Selection */}
            <div style={{
              background: "rgba(16, 14, 26, 0.6)",
              padding: 16,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🎙️</span>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", display: "block" }}>
                    AI Voiceover Narration:
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Natural neural TTS voices with Hinglish and technical term fluency
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <select
                  className="select-input"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                  disabled={previewingVoice}
                  onClick={handlePreviewVoice}
                >
                  {previewingVoice ? <span className="spinner" /> : "🔊 Preview Voice"}
                </button>
              </div>
            </div>
          </div>

          {/* Generated Scenes & Storyboard Editor */}
          {topicResult && (
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📜</span> Storyboard & Scene Editor ({topicResult.scenes?.length || 0} Scenes)
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Source: {topicResult.mode === "llm" ? "LLM API" : topicResult.mode === "custom-edited" ? "User Customized" : "Template Storyboard"} • You can edit narration and code below!
                  </span>
                </div>
                {!remotionDownload && (
                  <button
                    className="btn btn-violet"
                    disabled={busy}
                    onClick={handleRenderExplainer}
                  >
                    {busy ? <><span className="spinner" /> Rendering…</> : <><span>🚀</span> Render Reel with Voiceover</>}
                  </button>
                )}
              </div>

              {/* Scene Cards Grid (Editable) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
                {topicResult.scenes?.map((scene, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(20, 18, 30, 0.75)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: "rgba(139, 92, 246, 0.2)",
                        color: "#c4b5fd",
                        fontWeight: 700,
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4
                      }}>
                        Scene {i + 1}
                      </span>
                      <input
                        className="text-input"
                        style={{ padding: "4px 8px", fontSize: 13, fontWeight: 700, color: "var(--accent-gold)" }}
                        value={scene.title}
                        onChange={(e) => handleSceneChange(i, "title", e.target.value)}
                        placeholder="Scene Title"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        🗣️ Voiceover Narration:
                      </label>
                      <textarea
                        className="text-input"
                        rows={3}
                        style={{ fontSize: 12, resize: "vertical", lineHeight: 1.4 }}
                        value={scene.narration}
                        onChange={(e) => handleSceneChange(i, "narration", e.target.value)}
                        placeholder="Spoken narration for this scene"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        💻 Animated Code:
                      </label>
                      <textarea
                        className="code-preview"
                        rows={4}
                        style={{ width: "100%", fontSize: 11, resize: "vertical", outline: "none" }}
                        value={scene.code}
                        onChange={(e) => handleSceneChange(i, "code", e.target.value)}
                        placeholder="// Code snippet to animate"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Remotion Output Preview & Download */}
              {remotionDownload && (
                <div style={{
                  background: "rgba(139, 92, 246, 0.08)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: 20
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#c4b5fd", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>🎬</span> Remotion Explainer Reel Ready
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                        1080×1920 • 60fps • Real Studio AI Voiceover & Animated Syntax
                      </p>
                    </div>
                    <a
                      href={remotionDownload}
                      download={`explainer_${topic.replace(/\s+/g, "_").toLowerCase()}.mp4`}
                      className="btn btn-emerald"
                      style={{ padding: "10px 20px" }}
                    >
                      <span>⬇️</span> Download Explainer Reel (.mp4)
                    </a>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <video
                      controls
                      src={remotionDownload}
                      style={{
                        maxHeight: 480,
                        aspectRatio: "9/16",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                        border: "1px solid var(--border-subtle)",
                        background: "#000"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
