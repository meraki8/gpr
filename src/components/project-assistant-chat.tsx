"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Send, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type KbEntry = {
  id: string;
  source: string;
  sourceTypeLabel: string | null;
  title: string;
};

const SUGGESTIONS = [
  "What did we decide in the last meeting?",
  "What are the open commitments and who owns them?",
  "What's coming up this week?",
];

const SOURCE_BADGE_COLOR: Record<string, string> = {
  transcript: "var(--red)",
  github: "var(--ink)",
  jira: "var(--ink)",
  manual: "var(--mute)",
};

export function ProjectAssistantChat({
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

  // Index KB entries by their 1-based [KB-N] tag for quick lookup
  // when rendering citations.
  const kbByIndex = useMemo(() => {
    const m = new Map<number, KbEntry>();
    kbEntries.forEach((e, i) => m.set(i + 1, e));
    return m;
  }, [kbEntries]);

  // Auto-scroll to the bottom on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  function submit() {
    const text = input.trim();
    if (!text || pending) return;
    sendMessage({ text });
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          minHeight: 320,
          maxHeight: "calc(100vh - 380px)",
          overflowY: "auto",
          padding: "8px 4px",
          border: "1px solid var(--line)",
          borderRadius: 6,
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
              padding: 16,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                kbByIndex={kbByIndex}
              />
            ))}
            {pending && messages[messages.length - 1]?.role === "user" && (
              <li
                style={{
                  display: "flex",
                  gap: 12,
                  color: "var(--mute)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 28,
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                    paddingTop: 2,
                  }}
                >
                  <Bot size={16} />
                </span>
                <span className="blink">Thinking…</span>
              </li>
            )}
          </ul>
        )}
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
          {error.message || "Something went wrong."}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Ask about decisions, commitments, deadlines, who's on what…"
          className="field"
          style={{
            flex: 1,
            resize: "vertical",
            minHeight: 56,
            fontSize: 14,
            padding: "12px 14px",
          }}
          disabled={pending}
        />
        <button
          type="submit"
          className="pill pill-red"
          disabled={pending || input.trim().length === 0}
          style={{ height: 56 }}
          aria-label="Send"
        >
          <Send size={14} />
          <span>{pending ? "…" : "Send"}</span>
        </button>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          marginBottom: 16,
        }}
      >
        <Bot size={20} />
      </div>
      <div
        className="h-s"
        style={{ fontSize: 18, marginBottom: 6 }}
      >
        Ask GPR
      </div>
      <p
        className="mute-ink"
        style={{ fontSize: 13, margin: "0 auto", maxWidth: 480 }}
      >
        Grounded in this project&apos;s brief and knowledge base — not
        general knowledge. The assistant will say so when it doesn&apos;t
        know.
      </p>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="pill pill-ghost pill-sm"
            onClick={() => onPick(s)}
            style={{ cursor: "pointer" }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
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

  // Distinct KB indices cited in the response, in first-mention order.
  const citedIndices = useMemo(() => {
    if (isUser) return [] as number[];
    const found = new Set<number>();
    const re = /\[KB-(\d+)\]/g;
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (n > 0) found.add(n);
    }
    return [...found].sort((a, b) => a - b);
  }, [text, isUser]);

  return (
    <li
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 28,
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          paddingTop: 4,
          color: isUser ? "var(--mute)" : "var(--ink)",
        }}
        aria-hidden
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {isUser ? text : <CitedText text={text} kbByIndex={kbByIndex} />}
        </div>
        {!isUser && citedIndices.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span
              className="label"
              style={{
                fontSize: 10,
                color: "var(--mute)",
                marginRight: 2,
                paddingTop: 3,
              }}
            >
              Sources
            </span>
            {citedIndices.map((n) => {
              const entry = kbByIndex.get(n);
              return (
                <SourceBadge
                  key={n}
                  index={n}
                  entry={entry}
                />
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

// Render text with [KB-N] tags replaced by inline pills. Streaming-safe:
// any partial match like "[KB-" at the very end stays as raw text until
// the closing bracket arrives.
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
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    const n = Number(m[1]);
    const entry = kbByIndex.get(n);
    parts.push(
      <InlineCitation
        key={`cite-${key++}`}
        index={n}
        entry={entry}
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
        padding: "1px 6px",
        margin: "0 2px",
        borderRadius: 4,
        fontSize: 11,
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
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        color: "#fff",
        background: color,
        maxWidth: 280,
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
