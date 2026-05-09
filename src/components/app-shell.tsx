"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

type SidebarGroup = { id: string; name: string };
type SidebarProject = { id: string; name: string };

export type AppShellProps = {
  user: { name: string | null; email: string };
  allGroups: SidebarGroup[];
  activeGroup: SidebarGroup | null;
  groupProjects: SidebarProject[];
  currentProject?: SidebarProject | null;
  children: ReactNode;
};

export function AppShell({
  user,
  allGroups,
  activeGroup,
  groupProjects,
  currentProject,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-0">
      <aside
        className="shrink-0 sticky top-0 self-start hidden md:flex flex-col"
        style={{
          width: 260,
          height: "100vh",
          borderRight: "1px solid var(--line)",
          padding: "24px 18px 24px 24px",
        }}
      >
        <Link href="/dashboard" className="mb-8 inline-flex">
          <Wordmark />
        </Link>

        {/* Group switcher */}
        <GroupSwitcher
          activeGroup={activeGroup}
          allGroups={allGroups}
        />

        {/* Projects in the active group */}
        {activeGroup && (
          <div style={{ marginTop: 22 }}>
            <div
              className="label"
              style={{ paddingLeft: 16, marginBottom: 10 }}
            >
              Projects
            </div>
            <nav
              className="flex flex-col"
              style={{ gap: 2, minWidth: 0 }}
            >
              {groupProjects.length === 0 ? (
                <span
                  className="mute-ink"
                  style={{ fontSize: 13, paddingLeft: 16 }}
                >
                  None yet
                </span>
              ) : (
                groupProjects.map((p) => (
                  <SidebarItem
                    key={p.id}
                    href={`/projects/${p.id}`}
                    label={p.name}
                    active={
                      currentProject?.id === p.id ||
                      pathname === `/projects/${p.id}` ||
                      pathname.startsWith(`/projects/${p.id}/`)
                    }
                  />
                ))
              )}
            </nav>
          </div>
        )}

        {/* Project sub-nav */}
        {currentProject && (
          <div style={{ marginTop: 22 }}>
            <div
              className="label"
              style={{
                paddingLeft: 16,
                marginBottom: 10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={currentProject.name}
            >
              {currentProject.name}
            </div>
            <nav
              className="flex flex-col"
              style={{ gap: 2, minWidth: 0 }}
            >
              <SidebarItem
                href={`/projects/${currentProject.id}`}
                label="Overview"
                active={pathname === `/projects/${currentProject.id}`}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/members`}
                label="Members"
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/members`,
                )}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/transcripts`}
                label="Transcripts"
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/transcripts`,
                )}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/reports`}
                label="Match reports"
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/reports`,
                )}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/kb`}
                label="Knowledge base"
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/kb`,
                )}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/sources`}
                label="Sources"
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/sources`,
                )}
              />
            </nav>
          </div>
        )}

        {/* User chip */}
        <div
          className="mt-auto pt-5 flex items-center"
          style={{
            borderTop: "1px solid var(--line)",
            gap: 12,
            minWidth: 0,
          }}
        >
          <UserButton />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.name ?? undefined}
            >
              {user.name ?? user.email.split("@")[0]}
            </div>
            <div
              className="mute-ink"
              style={{
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.email}
            >
              {user.email}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}

function GroupSwitcher({
  activeGroup,
  allGroups,
}: {
  activeGroup: SidebarGroup | null;
  allGroups: SidebarGroup[];
}) {
  const hasOtherGroups = allGroups.length > 1;
  const hasNoGroups = allGroups.length === 0;

  if (hasNoGroups) {
    return (
      <div
        style={{
          padding: "12px 16px",
          border: "1px dashed var(--line)",
          fontSize: 13,
          color: "var(--mute)",
        }}
      >
        No groups yet
      </div>
    );
  }

  // Always render a <details>; collapse the chevron when there's
  // nothing to switch to so the UI doesn't lie about being clickable.
  return (
    <details
      style={{ position: "relative", minWidth: 0 }}
      // The native <details> toggle is the cheapest accessible
      // dropdown — keyboard, focus, click-outside-to-close all free.
      // No client-side state needed.
    >
      <summary
        style={{
          listStyle: "none",
          cursor: hasOtherGroups ? "pointer" : "default",
          padding: "10px 12px 10px 16px",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
        title={activeGroup?.name}
      >
        <span
          className="label"
          style={{
            fontSize: 10,
            color: "var(--mute)",
            marginRight: 4,
          }}
        >
          GROUP
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeGroup?.name ?? "Pick a group"}
        </span>
        {hasOtherGroups && (
          <span
            aria-hidden
            style={{
              fontSize: 10,
              color: "var(--mute)",
              transform: "translateY(1px)",
            }}
          >
            ▾
          </span>
        )}
      </summary>
      {hasOtherGroups && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            background: "var(--bg, #fff)",
            border: "1px solid var(--line)",
            zIndex: 10,
            maxHeight: 320,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
          }}
        >
          {allGroups.map((g) => {
            const isActive = activeGroup?.id === g.id;
            return (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                title={g.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: isActive ? "var(--ink)" : "var(--ink-2)",
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: "none",
                  borderBottom: "1px solid var(--line-2)",
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    background: isActive
                      ? "var(--red)"
                      : "transparent",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.name}
                </span>
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            style={{
              display: "block",
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--mute)",
              textDecoration: "none",
            }}
          >
            + New group
          </Link>
        </div>
      )}
    </details>
  );
}

function SidebarItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className="relative flex items-center"
      style={{
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        color: active ? "var(--ink)" : "var(--mute)",
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        padding: "6px 8px 6px 16px",
        transition: "color 0.12s",
        textDecoration: "none",
      }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 4,
            height: 4,
            background: "var(--red)",
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Link>
  );
}
