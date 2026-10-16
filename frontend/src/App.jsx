import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

export default function App() {
  const [activeTab, setActiveTab] = useState("mode1");
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Mode 1 state
  const [project, setProject] = useState(null);
  const [range, setRange] = useState({ start: 0, end: 45 });
  const [downloadUrl, setDownloadUrl] = useState("");
  const [renderFilename, setRenderFilename] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const sourceVideoRef = useRef(null);

  // Mode 2 state
  const [topic, setTopic] = useState("Python Async / Await");
  const [topicResult, setTopicResult] = useState(null);
  const [remotionDownload, setRemotionDownload] = useState("");

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

  useEffect(() => {
    checkHealth();
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

  // Upload handler
  const handleUploadFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["mp4", "mov", "webm"].includes(ext)) {
      setError("Please select an MP4, MOV, or WebM video file.");
      return;
    }
    const execute = runAsync("Uploading and scanning video…", async () => {
      const fd = new FormData();
      fd.append("video", file);
      const data = await j("/api/upload", { method: "POST", body: fd });
      setProject(data);
      const dur = data.duration || 45;
      setRange({ start: 0, end: Math.min(dur, 45) });
      setDownloadUrl("");
      setSuccess(`Uploaded "${file.name}" (${Math.round(dur)}s). Ready to analyze.`);
    });
    execute();
  };

  // Mode 1: Analyze
  const handleAnalyze = runAsync("Analyzing speech, motion & scenes…", async () => {
    if (!project) return;
    const data = await j(`/api/projects/${project.id}/analyze`, { method: "POST" });
    setProject(data);
    if (data.clips && data.clips.length > 0) {
      setRange({ start: data.clips[0].start, end: data.clips[0].end });
    }
    setSuccess(
      data.mode === "whisper"
        ? `Analysis complete! Extracted ${data.words?.length || 0} words and generated sentence-aligned clips.`
        : "Demo analysis complete! (ENABLE_WHISPER=true in backend .env to enable deep AI speech transcription)."
    );
  });

  // Mode 1: Render
  const handleRender = runAsync("Cropping to 9:16, tracking motion & burning karaoke captions…", async () => {
    if (!project) return;
    const s = Math.max(0, +range.start);
    const e = Math.min(project.duration || 9999, +range.end);
    if (e <= s) {
      throw new Error("End timestamp must be greater than start timestamp.");
    }
    if (e - s > 180) {
      throw new Error("Maximum reel duration is 3 minutes (180s). Please select a clip up to 180 seconds.");
    }
    const data = await j(`/api/projects/${project.id}/render`, post({ start: s, end: e }));
    setDownloadUrl(API + data.download);
    setRenderFilename(data.filename || "reel.mp4");
    setSuccess("Reel rendered successfully! Preview below or download your 9:16 vertical video.");
  });

  // Mode 2: Generate Script
  const handleGenerateScript = runAsync("Synthesizing 4-scene technical script…", async () => {
    const data = await j("/api/topic-video", post({ topic, render: false }));
    setTopicResult(data);
    setRemotionDownload("");
    setSuccess(`Generated 4-scene script via ${data.mode === "llm" ? "Claude LLM" : "template engine"}.`);
  });

  // Mode 2: Render Explainer Video
  const handleRenderExplainer = runAsync("Compiling Remotion 60fps code explainer video…", async () => {
    const data = await j("/api/topic-video", post({ topic, render: true }));
    setTopicResult(data);
    if (data.error) {
      throw new Error(`Remotion error: ${data.error}`);
    }
    if (data.download) {
      setRemotionDownload(API + data.download);
      setSuccess("Remotion explainer video generated and rendered successfully!");
    }
  });

  const duration = project?.duration || 60;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 80px" }}>
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
              Intelligent Vertical Video Reframing, Karaoke Captions & Motion Explainer Suite
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
            <span className={`badge ${health?.remotion ? "badge-active" : "badge-inactive"}`}>
              Remotion: {health?.remotion ? "Ready" : "Standby"}
            </span>
            <span className={`badge ${health?.whisper ? "badge-active" : "badge-inactive"}`}>
              Whisper: {health?.whisper ? "AI Mode" : "Demo Mode"}
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
          <span>✨</span> Mode 2: Topic → Remotion Motion Explainer
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
              Supports MP4, MOV, or WebM desktop or lecture recordings. Reframing automatically tracks screen focus and burns karaoke captions.
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
                MP4, MOV, WebM • Up to several gigabytes
              </p>
            </div>
          </div>

          {/* Project Details & Analysis */}
          {project && (
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🔍</span> Step 2: Speech & Scene Analysis
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

              {/* Source Video Preview if available */}
              {project.url && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Source Video Preview:</p>
                  <video
                    ref={sourceVideoRef}
                    controls
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

              {/* Scored Clips recommendation */}
              {project.clips && project.clips.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-gold)" }}>
                      🎯 AI Identified Candidate Reel Clips (Click to Select):
                    </p>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      Mode: {project.mode === "whisper" ? "Whisper AI" : "Demo"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    {project.clips.map((clip, idx) => {
                      const isSelected = Math.abs(range.start - clip.start) < 0.2 && Math.abs(range.end - clip.end) < 0.2;
                      return (
                        <div
                          key={idx}
                          onClick={() => setRange({ start: clip.start, end: clip.end })}
                          style={{
                            background: isSelected ? "rgba(229, 191, 112, 0.12)" : "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${isSelected ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                            borderRadius: "var(--radius-md)",
                            padding: "14px 16px",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? "var(--accent-gold)" : "#fff" }}>
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
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                            {formatTime(clip.start)} → {formatTime(clip.end)} ({Math.round(clip.end - clip.start)}s)
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>
                            {clip.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Timeline Scrubber & Selection */}
              <div style={{ marginTop: 12, marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                    Timeline & Crop Range Selection
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-gold)" }}>
                    Selected: {formatTime(range.start)} – {formatTime(range.end)} ({Math.max(0, range.end - range.start).toFixed(1)}s)
                  </span>
                </div>

                {/* Timeline bar with clip markers */}
                <div className="timeline-track" style={{ marginBottom: 14 }}>
                  {/* Candidate clips blocks */}
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

                {/* Sliders */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Start Timestamp</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-gold)" }}>{(+range.start).toFixed(1)}s ({formatTime(range.start)})</span>
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
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>End Timestamp</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-gold)" }}>{(+range.end).toFixed(1)}s ({formatTime(range.end)})</span>
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

              {/* Render Action Button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  className="btn btn-gold"
                  style={{ padding: "12px 24px", fontSize: 15 }}
                  disabled={busy}
                  onClick={handleRender}
                >
                  {busy ? <><span className="spinner" /> {busyMessage}</> : <><span>🎬</span> Render Vertical 9:16 Reel</>}
                </button>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Generates 1080×1920 MP4 with dynamic focus panning and burned-in karaoke subtitles
                </span>
              </div>

              {/* Download / Preview Section */}
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
                        <span>✨</span> Render Complete!
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{renderFilename}</p>
                    </div>
                    <a
                      href={downloadUrl}
                      download={renderFilename}
                      className="btn btn-emerald"
                      style={{ padding: "10px 20px" }}
                    >
                      <span>⬇️</span> Download Reel (.mp4)
                    </a>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <video
                      controls
                      src={downloadUrl}
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

      {/* MODE 2 CONTENT */}
      {activeTab === "mode2" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span>💡</span> Topic to Animated Code Explainer
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>
              Generate structured 4-scene code explainer videos rendered with Remotion (animated typing code, highlighting karaoke captions, 1080×1920 60fps).
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

            {/* Topic Input & Buttons */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
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
                {busy && busyMessage.includes("Remotion") ? <><span className="spinner" /> Rendering 60fps…</> : <><span>✨</span> Generate & Render Reel</>}
              </button>
            </div>
          </div>

          {/* Generated Scenes Preview */}
          {topicResult && (
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📜</span> Storyboard & Code Preview ({topicResult.scenes?.length || 0} Scenes)
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Source: {topicResult.mode === "llm" ? "Claude Sonnet (LLM)" : "Built-in Template Engine"}
                  </span>
                </div>
                {!remotionDownload && (
                  <button
                    className="btn btn-violet"
                    disabled={busy}
                    onClick={handleRenderExplainer}
                  >
                    {busy ? <><span className="spinner" /> Rendering…</> : <><span>🚀</span> Render with Remotion</>}
                  </button>
                )}
              </div>

              {/* Scene Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
                {topicResult.scenes?.map((scene, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(20, 18, 30, 0.7)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-gold)" }}>{scene.title}</h4>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-main)", marginBottom: 12, lineHeight: 1.4 }}>
                        🗣️ &ldquo;{scene.narration}&rdquo;
                      </p>
                    </div>
                    <div>
                      <pre className="code-preview" style={{ fontSize: 11, padding: "8px 10px" }}>
                        {scene.code}
                      </pre>
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
                        1080×1920 • 60fps Smooth Typography & Syntax Animation
                      </p>
                    </div>
                    <a
                      href={remotionDownload}
                      download={`explainer_${topic.replace(/\s+/g, "_").toLowerCase()}.mp4`}
                      className="btn btn-emerald"
                      style={{ padding: "10px 20px" }}
                    >
                      <span>⬇️</span> Download Explainer Video (.mp4)
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
