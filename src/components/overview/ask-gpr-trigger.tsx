"use client";

import { Bot } from "lucide-react";

export const ASK_GPR_OPEN_EVENT = "gpr:open-ask";

export function AskGprTrigger() {
  return (
    <button
      type="button"
      className="pill pill-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(ASK_GPR_OPEN_EVENT));
      }}
    >
      <Bot size={14} strokeWidth={2.2} />
      Ask GPR
    </button>
  );
}
