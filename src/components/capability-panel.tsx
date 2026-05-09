import { Check, X } from "lucide-react";
import {
  CAPABILITY_LABELS,
  MEMBER_TOGGLEABLE,
  OWNER_ONLY,
  resolveCapability,
} from "@/lib/capabilities";
import type { ProjectRole } from "@prisma/client";
import { toggleMemberCapability } from "@/app/projects/[projectId]/members/actions";

type StoredCapability = { capability: string; enabled: boolean };

export function CapabilityPanel({
  projectId,
  projectMemberId,
  memberRole,
  storedCapabilities,
  viewerCanEdit,
}: {
  projectId: string;
  projectMemberId: string;
  memberRole: ProjectRole;
  storedCapabilities: StoredCapability[];
  // Owner viewing a non-owner row → true. Anyone else (including
  // owner viewing self) → false.
  viewerCanEdit: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px 0 4px 76px",
        display: "grid",
        gap: 24,
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <CapabilityGroup
        title="Member capabilities"
        sub={
          memberRole === "OWNER"
            ? "Owner has every capability."
            : "Defaults to enabled. Owner can disable per member."
        }
      >
        {MEMBER_TOGGLEABLE.map((cap) => {
          const enabled = resolveCapability(
            memberRole,
            cap,
            storedCapabilities,
          );
          return (
            <CapabilityRow
              key={cap}
              label={CAPABILITY_LABELS[cap] ?? cap}
              enabled={enabled}
              control={
                viewerCanEdit ? (
                  <ToggleForm
                    projectId={projectId}
                    projectMemberId={projectMemberId}
                    capability={cap}
                    enabled={enabled}
                  />
                ) : null
              }
            />
          );
        })}
      </CapabilityGroup>

      <CapabilityGroup
        title="Owner-only"
        sub="Tied to the OWNER role — not toggleable."
      >
        {OWNER_ONLY.map((cap) => {
          const enabled = resolveCapability(
            memberRole,
            cap,
            storedCapabilities,
          );
          return (
            <CapabilityRow
              key={cap}
              label={CAPABILITY_LABELS[cap] ?? cap}
              enabled={enabled}
              control={null}
            />
          );
        })}
      </CapabilityGroup>
    </div>
  );
}

function CapabilityGroup({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 4 }}>
        {title}
      </div>
      <p
        className="mute-ink"
        style={{ fontSize: 12, marginTop: 0, marginBottom: 14 }}
      >
        {sub}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 8,
        }}
      >
        {children}
      </ul>
    </div>
  );
}

function CapabilityRow({
  label,
  enabled,
  control,
}: {
  label: string;
  enabled: boolean;
  control: React.ReactNode;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
      }}
    >
      <span
        aria-label={enabled ? "Enabled" : "Disabled"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: 999,
          flexShrink: 0,
          background: enabled ? "var(--status-good)" : "var(--mute-2)",
          color: "#fff",
        }}
      >
        {enabled ? <Check size={12} /> : <X size={12} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {control}
    </li>
  );
}

// Server-form toggle: each click submits, the page revalidates, the
// row re-renders with the new state. No client JS needed.
function ToggleForm({
  projectId,
  projectMemberId,
  capability,
  enabled,
}: {
  projectId: string;
  projectMemberId: string;
  capability: string;
  enabled: boolean;
}) {
  const next = enabled ? "false" : "true";
  return (
    <form action={toggleMemberCapability}>
      <input type="hidden" name="projectId" value={projectId} />
      <input
        type="hidden"
        name="projectMemberId"
        value={projectMemberId}
      />
      <input type="hidden" name="capability" value={capability} />
      <input type="hidden" name="enabled" value={next} />
      <button
        type="submit"
        title={enabled ? "Disable" : "Enable"}
        aria-label={
          enabled ? `Disable ${capability}` : `Enable ${capability}`
        }
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          border: 0,
          padding: 0,
          cursor: "pointer",
          background: enabled ? "var(--ink)" : "var(--line)",
          position: "relative",
          transition: "background 0.12s",
          fontFamily: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "var(--bg)",
            transition: "left 0.12s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      </button>
    </form>
  );
}
