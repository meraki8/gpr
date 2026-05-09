"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type KbEntry = {
  id: string;
  source: string;
  sourceTypeLabel: string | null;
  title: string;
};

const SUGGESTIONS = [
  "What did we decide last meeting?",
  "Who is on what?",
  "What's coming up this week?",
];

const SOURCE_BADGE_COLOR: Record<string, string> = {
  transcript: "var(--red)",
  github: "var(--ink)",
  jira: "var(--ink)",
  manual: "var(--mute)",
};

const PANEL_WIDTH = 400;

export function AskGprPanel({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [kbEntries, setKbEntries] = useState<KbEntry[] | null>(null);

  // Lazy-load the slim KB list the first time the panel opens — used
  // to resolve [KB-N] citations back to titles + source colors.
  useEffect(() => {
    if (!open || kbEntries !== null) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/kb-list`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j) => {
        if (cancelled) return;
        setKbEntries(j.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setKbEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, kbEntries]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Trigger — fixed bottom right, hides while panel is open. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Ask GPR"
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 90,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 999,
            background: "var(--ink)",
            color: "var(--bg)",
            border: 0,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
          }}
        >
          <Bot size={16} />
          <span>Ask GPR</span>
        </button>
      )}

      {/* Panel — slides in from the right. */}
      <aside
        aria-hidden={!open}
        aria-label="Ask GPR"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          maxWidth: "100vw",
          background: "var(--bg)",
          borderLeft: "1px solid var(--line)",
          boxShadow: open ? "-12px 0 32px rgba(0, 0, 0, 0.12)" : "none",
          transform: open ? "translateX(0)" : `translateX(${PANEL_WIDTH + 40}px)`,
          transition: "transform 0.22s ease",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PanelHeader
          projectName={projectName}
          kbCount={kbEntries?.length ?? 0}
          onClose={() => setOpen(false)}
        />
        {open && (
          <ChatBody
            projectId={projectId}
            kbEntries={kbEntries ?? []}
          />
        )}
      </aside>
    </>
  );
}

function PanelHeader({
  projectName,
  kbCount,
  onClose,
}: {
  projectName: string;
  kbCount: number;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "var(--red)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Bot size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={projectName}
        >
          Ask GPR · {projectName}
        </div>
        <div
          className="mute-ink"
          style={{ fontSize: 11 }}
        >
          {kbCount === 0
            ? "Grounded in this project's brief"
            : `${kbCount} KB entr${kbCount === 1 ? "y" : "ies"} available`}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 30,
          height: 30,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: 0,
          color: "var(--mute)",
          cursor: "pointer",
          borderRadius: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ChatBody({
  projectId,
  kbEntries,
}: {
  projectId: string;
  kbEntries: KbEntry[];
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/projects/${projectId}/ask`,
    }),
  });

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = status === "submitted" || status === "streaming";

  const kbByIndex = useMemo(() => {
    const m = new Map<number, KbEntry>();
    kbEntries.forEach((e, i) => m.set(i + 1, e));
    return m;
  }, [kbEntries]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || pending) return;
    sendMessage({ text });
    setInput("");
  }, [input, pending, sendMessage]);

  return (
    <>
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "16px 14px",
          background: "var(--paper)",
        }}
      >
        {messages.length === 0 ? (
          <EmptyState
            onPick={(q) => {
              setInput(q);
              inputRef.current?.focus();
            }}
          />
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                kbByIndex={kbByIndex}
              />
            ))}
            {pending && messages[messages.length - 1]?.role === "user" && (
              <li
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                <BotAvatar />
                <span
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    color: "var(--mute)",
                    fontSize: 13,
                  }}
                  className="blink"
                >
                  Thinking…
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            margin: "8px 14px 0",
            fontSize: 12,
            color: "var(--red)",
            padding: "8px 12px",
            border: "1px solid var(--red)",
            borderRadius: 4,
          }}
        >
          {error.message || "Something went wrong."}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          padding: 12,
          borderTop: "1px solid var(--line)",
          background: "var(--bg)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask about decisions, owners, deadlines…"
          className="field"
          style={{
            flex: 1,
            resize: "none",
            minHeight: 38,
            maxHeight: 120,
            padding: "9px 12px",
            fontSize: 13,
            lineHeight: 1.4,
          }}
          disabled={pending}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={pending || input.trim().length === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 999,
            background:
              pending || input.trim().length === 0
                ? "var(--mute-2)"
                : "var(--red)",
            color: "#fff",
            border: 0,
            cursor:
              pending || input.trim().length === 0
                ? "not-allowed"
                : "pointer",
            flexShrink: 0,
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div style={{ padding: "24px 8px", textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          marginBottom: 12,
          color: "var(--ink)",
        }}
      >
        <Bot size={18} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 6,
        }}
      >
        Ask anything about this project
      </div>
      <p
        className="mute-ink"
        style={{ fontSize: 12, margin: 0 }}
      >
        Grounded in the brief and KB. Won&apos;t guess.
      </p>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            style={{
              fontSize: 12,
              padding: "8px 12px",
              border: "1px solid var(--line)",
              background: "transparent",
              borderRadius: 8,
              color: "var(--ink-2)",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: "var(--red)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Bot size={12} />
    </span>
  );
}

function MessageBubble({
  message,
  kbByIndex,
}: {
  message: UIMessage;
  kbByIndex: Map<number, KbEntry>;
}) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");

  const citedIndices = useMemo(() => {
    if (isUser) return [] as number[];
    const found = new Set<number>();
    for (const m of text.matchAll(/\[KB-(\d+)\]/g)) {
      const n = Number(m[1]);
      if (n > 0) found.add(n);
    }
    return [...found].sort((a, b) => a - b);
  }, [text, isUser]);

  if (isUser) {
    return (
      <li
        style={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <span
          style={{
            maxWidth: "85%",
            padding: "9px 13px",
            borderRadius: 14,
            borderTopRightRadius: 4,
            background: "var(--ink)",
            color: "var(--bg)",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </span>
      </li>
    );
  }

  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <BotAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            borderTopLeftRadius: 4,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <CitedText text={text} kbByIndex={kbByIndex} />
        </div>
        {citedIndices.length > 0 && (
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              paddingLeft: 4,
            }}
          >
            {citedIndices.map((n) => (
              <SourceBadge
                key={n}
                index={n}
                entry={kbByIndex.get(n)}
              />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function CitedText({
  text,
  kbByIndex,
}: {
  text: string;
  kbByIndex: Map<number, KbEntry>;
}) {
  const re = /\[KB-(\d+)\]/g;
  const parts: Array<React.ReactNode> = [];
  let lastIndex = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const n = Number(m[1]);
    parts.push(
      <InlineCitation
        key={`cite-${key++}`}
        index={n}
        entry={kbByIndex.get(n)}
      />,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function InlineCitation({
  index,
  entry,
}: {
  index: number;
  entry: KbEntry | undefined;
}) {
  const color = entry
    ? (SOURCE_BADGE_COLOR[entry.source] ?? "var(--ink)")
    : "var(--mute-2)";
  return (
    <span
      title={entry ? `${entry.source}: ${entry.title}` : `KB-${index}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 5px",
        margin: "0 2px",
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 500,
        color: "#fff",
        background: color,
        verticalAlign: "baseline",
        whiteSpace: "nowrap",
      }}
    >
      KB-{index}
    </span>
  );
}

function SourceBadge({
  index,
  entry,
}: {
  index: number;
  entry: KbEntry | undefined;
}) {
  const color = entry
    ? (SOURCE_BADGE_COLOR[entry.source] ?? "var(--ink)")
    : "var(--mute-2)";
  return (
    <span
      title={entry ? entry.title : `KB-${index}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 500,
        color: "#fff",
        background: color,
        maxWidth: 200,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      <span style={{ opacity: 0.85 }}>KB-{index}</span>
      {entry && (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: 0.92,
          }}
        >
          {entry.title}
        </span>
      )}
    </span>
  );
}
