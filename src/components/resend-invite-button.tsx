"use client";

import { useEffect, useState, useTransition } from "react";
import { resendInvite } from "@/app/projects/[projectId]/actions";

const COOLDOWN_SECONDS = 60;

export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const disabled = isPending || cooldown > 0;

  function onClick() {
    if (disabled) return;
    setStatus("idle");
    startTransition(async () => {
      try {
        await resendInvite(inviteId);
        setStatus("success");
        setCooldown(COOLDOWN_SECONDS);
      } catch (err) {
        console.error("[resend-invite]", err);
        setStatus("error");
      }
    });
  }

  return (
    <div
      className="inline-flex items-center gap-3 shrink-0"
      style={{ fontSize: 12 }}
    >
      {status === "success" && cooldown > 0 && (
        <span style={{ color: "#1c8c4d", fontWeight: 500 }}>
          Invite resent
        </span>
      )}
      {status === "error" && (
        <span style={{ color: "var(--red)" }}>Failed</span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Resend invite"
        style={{
          fontFamily: "inherit",
          fontSize: 12,
          padding: 0,
          background: "none",
          border: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          color: disabled ? "var(--mute-2)" : "var(--ink)",
          borderBottom: disabled
            ? "1px solid transparent"
            : "1px solid var(--ink)",
          paddingBottom: 1,
          transition: "color 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.color = "var(--red)";
          e.currentTarget.style.borderBottomColor = "var(--red)";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          e.currentTarget.style.color = "var(--ink)";
          e.currentTarget.style.borderBottomColor = "var(--ink)";
        }}
      >
        {isPending
          ? "Sending…"
          : cooldown > 0
            ? `Wait ${cooldown}s`
            : "Resend"}
      </button>
    </div>
  );
}
