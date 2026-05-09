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

export function TranscriptUploadForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await analyzeTranscript(formData);
      } catch (e) {
        // Server action throws are bubbled here; redirect-on-success
        // throws a NEXT_REDIRECT we should not display.
        const msg = e instanceof Error ? e.message : "Something went wrong";
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
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
