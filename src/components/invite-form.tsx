"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/app/projects/[projectId]/actions";

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="email"
          name="email"
          placeholder="teammate@example.com"
          required
          className="field"
          style={{ width: 240 }}
        />
        <button type="submit" className="pill pill-sm" disabled={pending}>
          {pending ? "Sending…" : "Invite →"}
        </button>
      </div>
      {state?.error && (
        <span style={{ fontSize: 12, color: "var(--red)" }}>{state.error}</span>
      )}
    </form>
  );
}
