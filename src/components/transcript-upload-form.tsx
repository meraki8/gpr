"use client";

import { UploadCloud, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { analyzeTranscript } from "@/app/projects/[projectId]/actions";

function defaultMeetingAt(): string {
  const d = new Date();
  // datetime-local expects YYYY-MM-DDTHH:mm in the browser's local
  // timezone (no Z suffix). Build it without UTC conversion.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const DUPLICATE_PREFIX = "DUPLICATE_TRANSCRIPT|";

const ACCEPTED_TYPES = ".txt,.pdf,text/plain,application/pdf";

export function TranscriptUploadForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [duplicateIso, setDuplicateIso] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmDupRef = useRef(false);

  const onSubmit = (formData: FormData) => {
    setError(null);
    setDuplicateIso(null);
    if (confirmDupRef.current) {
      formData.set("confirmDuplicate", "true");
      confirmDupRef.current = false;
    }
    // If the user dropped a file via DnD it lives only in React
    // state — sync it onto the form so the server action sees it.
    if (file) {
      formData.set("file", file, file.name);
    }
    startTransition(async () => {
      try {
        await analyzeTranscript(formData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        if (msg.includes("NEXT_REDIRECT")) return;
        if (msg.startsWith(DUPLICATE_PREFIX)) {
          setDuplicateIso(msg.slice(DUPLICATE_PREFIX.length));
        } else {
          setError(msg);
        }
      }
    });
  };

  const runAnyway = () => {
    confirmDupRef.current = true;
    formRef.current?.requestSubmit();
  };

  const acceptFile = (list: FileList | File[]) => {
    const first = Array.from(list).find(
      (f) =>
        /\.(txt|pdf)$/i.test(f.name) ||
        f.type === "text/plain" ||
        f.type === "application/pdf",
    );
    if (!first) return;
    setFile(first);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const dropZoneStyle: React.CSSProperties = {
    position: "relative",
    border: `2px dashed ${dragOver ? "var(--red)" : "var(--line)"}`,
    background: dragOver
      ? "color-mix(in srgb, var(--red) 8%, var(--paper))"
      : "var(--paper)",
    borderRadius: 12,
    padding: "36px 24px",
    textAlign: "center",
    transition: "border-color 0.15s ease, background 0.15s ease",
    cursor: pending ? "not-allowed" : "pointer",
    opacity: pending ? 0.6 : 1,
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      style={{ display: "grid", gap: 14 }}
    >
      <input type="hidden" name="projectId" value={projectId} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 12,
        }}
      >
        <input
          type="text"
          name="title"
          placeholder="Meeting title (optional) — e.g. Sprint 3 standup"
          maxLength={200}
          className="field"
          disabled={pending}
        />
        <input
          type="datetime-local"
          name="meetingAt"
          defaultValue={defaultMeetingAt()}
          className="field num"
          disabled={pending}
          aria-label="Meeting timestamp"
        />
      </div>

      <textarea
        name="rawText"
        placeholder="[00:00] Maya: Atlas standup, May 9. Quick round.
[00:18] Maya: I'll have the API contract finalized by Thursday EOD."
        rows={9}
        className="field field-lg num"
        style={{ resize: "vertical" }}
        disabled={pending}
        onChange={() => {
          if (duplicateIso) setDuplicateIso(null);
        }}
      />

      {/* — or — divider */}
      <div
        aria-hidden
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 14,
          alignItems: "center",
          margin: "4px 0",
        }}
      >
        <span
          style={{
            height: 1,
            background: "var(--line)",
            display: "block",
          }}
        />
        <span
          className="label"
          style={{
            color: "var(--mute)",
            letterSpacing: "0.16em",
            padding: "0 4px",
          }}
        >
          or
        </span>
        <span
          style={{
            height: 1,
            background: "var(--line)",
            display: "block",
          }}
        />
      </div>

      {/* Drag-and-drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload transcript file"
        onClick={() => {
          if (!pending) fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !pending) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!pending) setDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!pending) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (pending) return;
          if (e.dataTransfer.files?.length) {
            acceptFile(e.dataTransfer.files);
          }
        }}
        style={dropZoneStyle}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept={ACCEPTED_TYPES}
          disabled={pending}
          onChange={(e) => {
            if (e.target.files) acceptFile(e.target.files);
          }}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            border: 0,
          }}
        />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 999,
            background: dragOver
              ? "var(--red)"
              : "color-mix(in srgb, var(--red) 14%, var(--paper))",
            color: dragOver ? "#fff" : "var(--red)",
            marginBottom: 14,
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          <UploadCloud size={22} strokeWidth={2} />
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--ink)",
            marginBottom: 4,
          }}
        >
          {dragOver
            ? "Drop it"
            : "Drag and drop your transcript here"}
        </div>
        <div className="mute-ink" style={{ fontSize: 13 }}>
          or click to browse
        </div>
        <div
          className="mute-ink"
          style={{ fontSize: 12, marginTop: 10, letterSpacing: "0.04em" }}
        >
          Accepts .txt and .pdf files
        </div>
      </div>

      {file && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--paper)",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </span>
          <span
            className="mute-ink num"
            style={{ fontSize: 12, whiteSpace: "nowrap" }}
          >
            {formatBytes(file.size)}
          </span>
          <button
            type="button"
            onClick={clearFile}
            disabled={pending}
            aria-label={`Remove ${file.name}`}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--mute)",
              cursor: pending ? "not-allowed" : "pointer",
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          className="mute-ink"
          style={{
            fontSize: 12,
            flex: 1,
            minWidth: 200,
          }}
        >
          {pending
            ? "Analysing — average ~14 seconds…"
            : "Paste, upload, or both. Whichever you have."}
        </span>

        <button
          type="submit"
          className="pill pill-red"
          disabled={pending}
        >
          {pending ? "Running…" : "Run analysis →"}
        </button>
      </div>

      {duplicateIso && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            padding: "12px 16px",
            border: "1px solid var(--status-watch)",
            borderRadius: 4,
            background: "var(--paper)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: 1, minWidth: 220 }}>
            This transcript looks similar to one uploaded on{" "}
            <strong>
              {new Date(duplicateIso).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
            . It may already be analysed.
          </span>
          <button
            type="button"
            onClick={() => setDuplicateIso(null)}
            className="pill pill-sm"
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runAnyway}
            className="pill pill-sm"
            disabled={pending}
          >
            Upload anyway
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: "var(--red)",
            padding: "10px 14px",
            border: "1px solid var(--red)",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
