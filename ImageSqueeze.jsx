import React, { useState, useRef, useCallback, useEffect } from "react";

// ImageSqueeze — browser-only image compressor.
// Everything runs client-side via Canvas. No uploads, no server.

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(b) {
  if (b === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function compressImage(file, { quality, maxDim, format }) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (maxDim && Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const mime =
    format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, format === "png" ? undefined : quality)
  );

  return { blob, width, height, mime };
}

export default function ImageSqueeze() {
  const [items, setItems] = useState([]);
  const [quality, setQuality] = useState(0.72);
  const [maxDim, setMaxDim] = useState(0); // 0 = keep original size
  const [format, setFormat] = useState("jpeg");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList).filter((f) => ACCEPT.includes(f.type));
      if (incoming.length === 0) return;
      setItems((prev) => [
        ...prev,
        ...incoming.map((file) => ({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          originalSize: file.size,
          result: null,
          status: "queued",
        })),
      ]);
    },
    []
  );

  const runCompression = useCallback(async () => {
    setBusy(true);
    for (const item of items) {
      if (item.result) continue;
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "working" } : it))
      );
      try {
        const { blob, width, height } = await compressImage(item.file, {
          quality,
          maxDim: maxDim || 0,
          format,
        });
        const url = URL.createObjectURL(blob);
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "done",
                  result: { blob, url, size: blob.size, width, height },
                }
              : it
          )
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error" } : it
          )
        );
      }
    }
    setBusy(false);
  }, [items, quality, maxDim, format]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => it.result?.url && URL.revokeObjectURL(it.result.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () => {
    items.forEach((it) => it.result?.url && URL.revokeObjectURL(it.result.url));
    setItems([]);
  };

  const outExt = format === "png" ? "png" : format === "webp" ? "webp" : "jpg";
  const downloadName = (name) => name.replace(/\.[^.]+$/, "") + `.${outExt}`;

  const totalOriginal = items.reduce((s, it) => s + it.originalSize, 0);
  const totalResult = items.reduce((s, it) => s + (it.result?.size || 0), 0);
  const doneCount = items.filter((it) => it.status === "done").length;
  const savedPct =
    totalResult > 0 && doneCount > 0
      ? Math.max(0, Math.round((1 - totalResult / totalOriginal) * 100))
      : 0;

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <span style={styles.mark} aria-hidden>▚</span>
          <h1 style={styles.wordmark}>
            image<span style={styles.wordmarkAccent}>squeeze</span>
          </h1>
        </div>
        <p style={styles.tagline}>
          Shrink images in your browser. Nothing is uploaded — files never leave this tab.
        </p>
      </header>

      {/* Ad slot (top). Replace with your ad network snippet later. */}
      <div className="ad-slot" style={styles.adSlot} aria-hidden>
        <span style={styles.adLabel}>ad</span>
      </div>

      <main style={styles.main}>
        <section
          className={`dropzone${dragging ? " dropzone--active" : ""}`}
          style={{
            ...styles.dropzone,
            ...(dragging ? styles.dropzoneActive : null),
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <span style={styles.dropIcon} aria-hidden>⤓</span>
          <p style={styles.dropTitle}>Drop images here</p>
          <p style={styles.dropSub}>or click to choose — JPG, PNG, or WebP</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        <section style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Quality
              <span style={styles.controlValue}>{Math.round(quality * 100)}</span>
            </label>
            <input
              type="range"
              min="0.3"
              max="0.95"
              step="0.01"
              value={quality}
              disabled={format === "png"}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              style={styles.range}
            />
            {format === "png" && (
              <span style={styles.hint}>PNG ignores quality (lossless).</span>
            )}
          </div>

          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Max width / height</label>
            <div style={styles.segment}>
              {[
                { v: 0, l: "Original" },
                { v: 1920, l: "1920" },
                { v: 1280, l: "1280" },
                { v: 800, l: "800" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setMaxDim(opt.v)}
                  style={{
                    ...styles.segmentBtn,
                    ...(maxDim === opt.v ? styles.segmentBtnActive : null),
                  }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Output format</label>
            <div style={styles.segment}>
              {[
                { v: "jpeg", l: "JPG" },
                { v: "webp", l: "WebP" },
                { v: "png", l: "PNG" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setFormat(opt.v)}
                  style={{
                    ...styles.segmentBtn,
                    ...(format === opt.v ? styles.segmentBtnActive : null),
                  }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </section>

        {items.length > 0 && (
          <section style={styles.actionBar}>
            <button
              onClick={runCompression}
              disabled={busy}
              style={{ ...styles.primaryBtn, ...(busy ? styles.btnDisabled : null) }}
            >
              {busy ? "Squeezing…" : `Squeeze ${items.length} image${items.length > 1 ? "s" : ""}`}
            </button>
            <button onClick={clearAll} style={styles.ghostBtn}>
              Clear
            </button>
            {doneCount > 0 && (
              <span style={styles.savedBadge}>
                {savedPct}% smaller · {formatBytes(totalOriginal)} → {formatBytes(totalResult)}
              </span>
            )}
          </section>
        )}

        <section style={styles.list}>
          {items.map((it) => {
            const pct =
              it.result && it.originalSize
                ? Math.max(0, Math.round((1 - it.result.size / it.originalSize) * 100))
                : null;
            return (
              <div key={it.id} style={styles.row}>
                <div style={styles.rowMain}>
                  <span style={styles.rowName} title={it.name}>
                    {it.name}
                  </span>
                  <span style={styles.rowMeta}>
                    {formatBytes(it.originalSize)}
                    {it.result && (
                      <>
                        <span style={styles.arrow}>→</span>
                        <span style={styles.rowResultSize}>
                          {formatBytes(it.result.size)}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div style={styles.rowRight}>
                  {it.status === "working" && (
                    <span style={styles.statusWorking}>working…</span>
                  )}
                  {it.status === "error" && (
                    <span style={styles.statusError}>couldn't read file</span>
                  )}
                  {it.status === "done" && (
                    <>
                      {pct !== null && (
                        <span
                          style={{
                            ...styles.pctPill,
                            ...(pct <= 0 ? styles.pctPillFlat : null),
                          }}
                        >
                          {pct > 0 ? `−${pct}%` : "no gain"}
                        </span>
                      )}
                      <a
                        href={it.result.url}
                        download={downloadName(it.name)}
                        style={styles.downloadBtn}
                      >
                        Download
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {items.length === 0 && (
          <p style={styles.emptyNote}>
            Batch-compress as many as you like. Everything stays on your device.
          </p>
        )}
      </main>

      <footer style={styles.footer}>
        <span>Runs entirely in your browser · No files stored</span>
      </footer>
    </div>
  );
}

const INK = "#0E1116";
const PANEL = "#161B22";
const PANEL_2 = "#1C232D";
const LINE = "#2A333F";
const TEXT = "#E6EDF3";
const MUTED = "#8A97A6";
const ACCENT = "#3DDC97"; // signal green — "compressed / go"
const ACCENT_DIM = "#1F6F52";

const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .dropzone:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }
  input[type="range"] { accent-color: ${ACCENT}; }
  @media (prefers-reduced-motion: no-preference) {
    .dropzone { transition: border-color .18s ease, background .18s ease; }
  }
  a { text-decoration: none; }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: INK,
    color: TEXT,
    fontFamily:
      "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px 24px",
  },
  header: { width: "100%", maxWidth: 720, marginBottom: 20 },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  mark: { color: ACCENT, fontSize: 26, lineHeight: 1, letterSpacing: "-2px" },
  wordmark: {
    margin: 0,
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  },
  wordmarkAccent: { color: ACCENT },
  tagline: { color: MUTED, fontSize: 15, marginTop: 10, marginBottom: 0, lineHeight: 1.5 },
  adSlot: {
    width: "100%",
    maxWidth: 720,
    height: 90,
    border: `1px dashed ${LINE}`,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    background: "rgba(255,255,255,0.015)",
  },
  adLabel: {
    color: "#4A5563",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
  },
  main: { width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 },
  dropzone: {
    border: `1.5px dashed ${LINE}`,
    borderRadius: 14,
    padding: "44px 24px",
    textAlign: "center",
    cursor: "pointer",
    background: PANEL,
  },
  dropzoneActive: { borderColor: ACCENT, background: PANEL_2 },
  dropIcon: { fontSize: 30, color: ACCENT, display: "block" },
  dropTitle: { fontSize: 18, fontWeight: 700, margin: "12px 0 4px" },
  dropSub: { color: MUTED, fontSize: 14, margin: 0 },
  controls: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 18,
    background: PANEL,
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: 20,
  },
  controlGroup: { display: "flex", flexDirection: "column", gap: 10 },
  controlLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlValue: { color: ACCENT, fontVariantNumeric: "tabular-nums", fontSize: 15 },
  range: { width: "100%" },
  hint: { color: "#6B7684", fontSize: 12 },
  segment: {
    display: "flex",
    gap: 6,
    background: INK,
    padding: 4,
    borderRadius: 10,
    border: `1px solid ${LINE}`,
  },
  segmentBtn: {
    flex: 1,
    padding: "9px 8px",
    borderRadius: 7,
    border: "none",
    background: "transparent",
    color: MUTED,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontVariantNumeric: "tabular-nums",
  },
  segmentBtnActive: { background: PANEL_2, color: TEXT, boxShadow: `inset 0 0 0 1px ${LINE}` },
  actionBar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  primaryBtn: {
    background: ACCENT,
    color: INK,
    border: "none",
    padding: "12px 22px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnDisabled: { opacity: 0.55, cursor: "default" },
  ghostBtn: {
    background: "transparent",
    color: MUTED,
    border: `1px solid ${LINE}`,
    padding: "12px 18px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  savedBadge: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: PANEL,
    border: `1px solid ${LINE}`,
    borderRadius: 10,
    padding: "12px 14px",
  },
  rowMain: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 },
  rowName: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: { fontSize: 13, color: MUTED, display: "flex", alignItems: "center", gap: 7, fontVariantNumeric: "tabular-nums" },
  arrow: { color: "#4A5563" },
  rowResultSize: { color: TEXT },
  rowRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  statusWorking: { color: MUTED, fontSize: 13 },
  statusError: { color: "#E5807A", fontSize: 13 },
  pctPill: {
    background: ACCENT_DIM,
    color: ACCENT,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 6,
    fontVariantNumeric: "tabular-nums",
  },
  pctPillFlat: { background: "#2A333F", color: MUTED },
  downloadBtn: {
    background: PANEL_2,
    color: TEXT,
    border: `1px solid ${LINE}`,
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyNote: { color: "#5B6672", fontSize: 13, textAlign: "center", marginTop: 4 },
  footer: {
    marginTop: 36,
    color: "#4A5563",
    fontSize: 12,
    textAlign: "center",
  },
};
