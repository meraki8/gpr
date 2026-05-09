"use client";

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

export function TranscriptUploadForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // ISO of the existing matching transcript when the server flags
  // this paste as a likely duplicate. Cleared on edit.
  const [duplicateIso, setDuplicateIso] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Ref (not state) — a single submit's confirmation flag, consumed
  // and reset within onSubmit so a later submit doesn't auto-confirm.
  const confirmDupRef = useRef(false);

  const onSubmit = (formData: FormData) => {
    setError(null);
    setDuplicateIso(null);
    if (confirmDupRef.current) {
      formData.set("confirmDuplicate", "true");
      confirmDupRef.current = false;
    }
    startTransition(async () => {
      try {
        await analyzeTranscript(formData);
      } catch (e) {
        // Server action throws are bubbled here; redirect-on-success
        // throws a NEXT_REDIRECT we should not display.
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
        placeholder={`[00:00] Maya: Atlas standup, May 9. Quick round.
[00:18] Maya: I'll have the API contract finalized by Thursday EOD.

— or upload a file below —`}
        rows={10}
        className="field field-lg num"
        style={{ resize: "vertical" }}
        disabled={pending}
        onChange={() => {
          // Editing the text invalidates a previous duplicate flag.
          if (duplicateIso) setDuplicateIso(null);
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          className="pill pill-ghost pill-sm"
          style={{
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.4 : 1,
          }}
        >
          {fileName ? `📎 ${fileName}` : "📎 Upload .txt or .pdf"}
          <input
            type="file"
            name="file"
            accept=".txt,.pdf,text/plain,application/pdf"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFileName(f ? f.name : null);
            }}
            style={{ display: "none" }}
          />
        </label>
        {fileName && !pending && (
          <button
            type="button"
            className="lk-mute"
            style={{
              fontSize: 12,
              background: "none",
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
            }}
            onClick={() => {
              setFileName(null);
              if (formRef.current) {
                const fileInput = formRef.current.querySelector(
                  'input[type="file"]',
                ) as HTMLInputElement | null;
                if (fileInput) fileInput.value = "";
              }
            }}
          >
            Clear file
          </button>
        )}

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
            This transcript appears to have already been uploaded on{" "}
            <strong>
              {new Date(duplicateIso).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
            . Are you sure you want to run a new analysis?
          </span>
          <button
            type="button"
            onClick={runAnyway}
            className="pill pill-sm"
            disabled={pending}
          >
            Run anyway →
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
