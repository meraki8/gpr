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
    <div className="flex items-center gap-2 shrink-0">
      {status === "success" && cooldown > 0 && (
        <span className="text-xs font-mono text-emerald-300">
          Invite resent
        </span>
      )}
      {status === "error" && (
        <span className="text-xs font-mono text-[#DC2626]">Failed</span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Resend invite"
        className={`text-xs font-mono px-2 py-1 ${
          disabled
            ? "text-white/30 cursor-not-allowed"
            : "text-white/70 hover:text-white hover:bg-white/10"
        }`}
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
