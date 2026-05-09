"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { nudgeMember } from "@/app/projects/[projectId]/leaderboard/actions";

type Props = {
  projectId: string;
  recipientUserId: string;
  recipientName: string;
  recipientScore: number;
  size?: "sm" | "md";
};

export function NudgeButton({
  projectId,
  recipientUserId,
  recipientName,
  recipientScore,
  size = "md",
}: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    defaultMessage(recipientName, recipientScore),
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onSend = () => {
    startTransition(async () => {
      const res = await nudgeMember({
        projectId,
        recipientUserId,
        message: message.trim(),
      });
      if (res.ok) {
        setStatus({ kind: "ok" });
        setTimeout(() => setOpen(false), 900);
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    });
  };

  const buttonPad = size === "sm" ? "6px 10px" : "8px 14px";
  const buttonFs = size === "sm" ? 12 : 13;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Don't toggle a wrapping <details> if we live inside one
          // (e.g. on the members page).
          e.preventDefault();
          e.stopPropagation();
          setMessage(defaultMessage(recipientName, recipientScore));
          setStatus({ kind: "idle" });
          setOpen(true);
        }}
        className="row-hover"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: buttonPad,
          fontSize: buttonFs,
          fontWeight: 600,
          color: "var(--ink)",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          cursor: "pointer",
          letterSpacing: "0.01em",
        }}
        title={`Nudge ${recipientName}`}
      >
        <Bell size={iconSize} strokeWidth={2.2} />
        Nudge
      </button>

      {open && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nudge-title"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              width: "100%",
              maxWidth: 480,
              padding: "22px 22px 18px",
              color: "var(--ink)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  className="label"
                  style={{
                    color: "var(--mute)",
                    marginBottom: 4,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                  }}
                >
                  Nudge
                </div>
                <div
                  id="nudge-title"
                  className="h-s"
                  style={{ fontSize: 18, color: "var(--ink)" }}
                >
                  Send {recipientName} a kick in the pants
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--mute)",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={pending}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: 1.5,
                background: "var(--bg)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontFamily: "inherit",
                outline: "none",
              }}
            />

            {status.kind === "err" && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--red)",
                }}
              >
                {status.msg}
              </div>
            )}
            {status.kind === "ok" && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--status-good)",
                }}
              >
                Sent. They&apos;ll feel that one.
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  background: "transparent",
                  color: "var(--mute)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={pending || message.trim().length === 0}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  background: "var(--red)",
                  color: "#fff",
                  border: "1px solid var(--red)",
                  borderRadius: 6,
                  cursor: pending ? "wait" : "pointer",
                  fontWeight: 600,
                  opacity:
                    pending || message.trim().length === 0 ? 0.6 : 1,
                }}
              >
                {pending ? "Sending…" : "Send nudge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function defaultMessage(name: string, score: number) {
  const first = name.split(/\s+/)[0] || name;
  return `Hey ${first}, the ref has noticed you haven't been active lately. Your current score is ${score}. Time to step up.`;
}
