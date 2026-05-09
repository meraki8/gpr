"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  ChevronDown,
  FileBarChart,
  FileText,
  Flag,
  GitBranch,
  Home,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  SquareKanban,
  Sun,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { AskGprPanel } from "./ask-gpr-panel";
import { NotificationsBell } from "./notifications-bell";

type SidebarGroup = { id: string; name: string };
type SidebarProject = {
  id: string;
  name: string;
  // Optional ISO string. When set and we're on a project page, the
  // sidebar shows a live deadline countdown above the user profile.
  deadlineIso?: string | null;
};
type Theme = "dark" | "light";

const STORAGE_THEME = "gpr_theme";
const STORAGE_COLLAPSED = "gpr_sidebar_collapsed";

const SIDEBAR_BG = "#0a0a0a";
const SIDEBAR_BORDER = "#1f1f1f";
const SIDEBAR_INK = "#f5f5f5";
const SIDEBAR_MUTE = "#888888";
const SIDEBAR_HOVER_BG = "rgba(255, 255, 255, 0.04)";
const SIDEBAR_RED = "#ff3b30";

const COLLAPSED_W = 56;
const EXPANDED_W = 220;

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
  const [theme, setTheme] = useState<Theme>("dark");
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate persisted preferences. Brief flash possible on first load
  // for users who chose light — acceptable; can be solved later with
  // an inline pre-hydration script if needed.
  useEffect(() => {
    const t = localStorage.getItem(STORAGE_THEME);
    if (t === "light" || t === "dark") setTheme(t);
    if (localStorage.getItem(STORAGE_COLLAPSED) === "1") setCollapsed(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_THEME, next);
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_COLLAPSED, next ? "1" : "0");
  };

  return (
    <div className="flex flex-1 min-h-0">
      <aside
        className="shrink-0 sticky top-0 self-start hidden md:flex flex-col"
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          height: "100vh",
          background: SIDEBAR_BG,
          color: SIDEBAR_INK,
          borderRight: `1px solid ${SIDEBAR_BORDER}`,
          padding: "14px 10px",
          transition: "width 0.18s ease",
        }}
      >
        {/* Wordmark / home link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center"
          style={{
            color: SIDEBAR_INK,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "-0.02em",
            padding: "8px 8px",
            marginBottom: 14,
            textDecoration: "none",
          }}
          title="GPR"
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              background: SIDEBAR_RED,
              borderRadius: 4,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {!collapsed && <span style={{ marginLeft: 10 }}>GPR</span>}
        </Link>

        {/* Group switcher */}
        <GroupSwitcher
          activeGroup={activeGroup}
          allGroups={allGroups}
          collapsed={collapsed}
        />

        {/* Projects in active group */}
        {activeGroup && (
          <div style={{ marginTop: 14 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: SIDEBAR_MUTE,
                  padding: "0 10px",
                  marginBottom: 6,
                }}
              >
                Projects
              </div>
            )}
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {groupProjects.length === 0 ? (
                !collapsed && (
                  <span
                    style={{
                      fontSize: 12,
                      color: SIDEBAR_MUTE,
                      padding: "4px 10px",
                    }}
                  >
                    None yet
                  </span>
                )
              ) : (
                groupProjects.map((p) => {
                  const isActive =
                    currentProject?.id === p.id ||
                    pathname === `/projects/${p.id}` ||
                    pathname.startsWith(`/projects/${p.id}/`);
                  return (
                    <SidebarItem
                      key={p.id}
                      href={`/projects/${p.id}`}
                      label={p.name}
                      icon={<ProjectInitial name={p.name} />}
                      active={isActive}
                      collapsed={collapsed}
                    />
                  );
                })
              )}
            </nav>
          </div>
        )}

        {/* Project sub-nav */}
        {currentProject && (
          <div style={{ marginTop: 14 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: SIDEBAR_MUTE,
                  padding: "0 10px",
                  marginBottom: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={currentProject.name}
              >
                {currentProject.name}
              </div>
            )}
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <SidebarItem
                href={`/projects/${currentProject.id}`}
                label="Overview"
                icon={<Home size={16} />}
                active={pathname === `/projects/${currentProject.id}`}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/members`}
                label="Members"
                icon={<Users size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/members`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/leaderboard`}
                label="Leaderboard"
                icon={<Trophy size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/leaderboard`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/transcripts`}
                label="Transcripts"
                icon={<FileText size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/transcripts`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/contract`}
                label="Contract"
                icon={<ScrollText size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/contract`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/reports`}
                label="Match reports"
                icon={<Flag size={16} color={SIDEBAR_RED} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/reports`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/kb`}
                label="Knowledge base"
                icon={<BookOpen size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/kb`,
                )}
                collapsed={collapsed}
              />
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: SIDEBAR_MUTE,
                    padding: "10px 10px 4px",
                  }}
                >
                  Sources
                </div>
              )}
              <SidebarItem
                href={`/projects/${currentProject.id}/sources/github`}
                label="GitHub"
                icon={<GitBranch size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/sources/github`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/sources/jira`}
                label="Jira"
                icon={<SquareKanban size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/sources/jira`,
                )}
                collapsed={collapsed}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/report`}
                label="Progress Report"
                icon={<FileBarChart size={16} />}
                active={pathname.startsWith(
                  `/projects/${currentProject.id}/report`,
                )}
                collapsed={collapsed}
              />
            </nav>
          </div>
        )}

        {/* Changelog */}
        <div style={{ marginTop: 14 }}>
          <SidebarItem
            href="/changelog"
            label="Changelog"
            icon={<Zap size={16} />}
            active={pathname === "/changelog"}
            collapsed={collapsed}
          />
        </div>

        {/* Bottom controls */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
            borderTop: `1px solid ${SIDEBAR_BORDER}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              flexDirection: collapsed ? "column" : "row",
              padding: "0 6px",
            }}
          >
            <IconButton
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
            <IconButton
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </IconButton>
          </div>

          {currentProject?.deadlineIso && (
            <SidebarDeadline
              iso={currentProject.deadlineIso}
              collapsed={collapsed}
            />
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px",
              minWidth: 0,
            }}
          >
            <UserButton />
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: SIDEBAR_INK,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={user.name ?? undefined}
                >
                  {user.name ?? user.email.split("@")[0]}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: SIDEBAR_MUTE,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={user.email}
                >
                  {user.email}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Themeable content area */}
      <div
        data-app-theme={theme}
        className="flex-1 min-w-0 flex flex-col"
        style={{
          background: "var(--bg)",
          color: "var(--ink)",
          minHeight: "100vh",
        }}
      >
        <NotificationsBell />
        {children}
        {/* Ask GPR is project-scoped — only mount on project pages.
            Trigger button is fixed bottom-right; panel slides in from
            the right and is rendered inside the themed content
            wrapper so its CSS variables resolve to the user's theme. */}
        {currentProject && (
          <AskGprPanel
            projectId={currentProject.id}
            projectName={currentProject.name}
          />
        )}
      </div>
    </div>
  );
}

function GroupSwitcher({
  activeGroup,
  allGroups,
  collapsed,
}: {
  activeGroup: SidebarGroup | null;
  allGroups: SidebarGroup[];
  collapsed: boolean;
}) {
  if (allGroups.length === 0) {
    return collapsed ? null : (
      <div
        style={{
          padding: "10px 12px",
          border: `1px dashed ${SIDEBAR_BORDER}`,
          fontSize: 12,
          color: SIDEBAR_MUTE,
          margin: "0 2px",
        }}
      >
        No groups yet
      </div>
    );
  }

  const initial = activeGroup?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <details style={{ position: "relative", minWidth: 0 }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: collapsed ? "8px" : "8px 10px",
          background: "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${SIDEBAR_BORDER}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          margin: "0 2px",
        }}
        title={activeGroup?.name ?? "Pick a group"}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: SIDEBAR_RED,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        {!collapsed && (
          <>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: 500,
                color: SIDEBAR_INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeGroup?.name ?? "Pick a group"}
            </span>
            <ChevronDown
              size={14}
              color={SIDEBAR_MUTE}
              style={{ flexShrink: 0 }}
            />
          </>
        )}
      </summary>

      <div
        style={{
          position: "absolute",
          left: collapsed ? "calc(100% + 8px)" : 2,
          right: collapsed ? "auto" : 2,
          top: collapsed ? 0 : "calc(100% + 4px)",
          minWidth: collapsed ? 220 : "auto",
          background: SIDEBAR_BG,
          border: `1px solid ${SIDEBAR_BORDER}`,
          borderRadius: 6,
          zIndex: 20,
          maxHeight: 360,
          overflowY: "auto",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
          padding: 4,
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
                padding: "8px 10px",
                fontSize: 13,
                color: isActive ? SIDEBAR_INK : "#cccccc",
                fontWeight: isActive ? 500 : 400,
                textDecoration: "none",
                borderRadius: 4,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: isActive ? SIDEBAR_RED : "transparent",
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
            padding: "8px 10px",
            fontSize: 12,
            color: SIDEBAR_MUTE,
            textDecoration: "none",
            borderTop: `1px solid ${SIDEBAR_BORDER}`,
            marginTop: 4,
            paddingTop: 10,
          }}
        >
          + New group
        </Link>
      </div>
    </details>
  );
}

function SidebarItem({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "8px" : "7px 10px",
        margin: "0 2px",
        borderRadius: 4,
        color: active ? SIDEBAR_INK : SIDEBAR_MUTE,
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        transition: "background 0.12s, color 0.12s",
        background: active ? SIDEBAR_HOVER_BG : "transparent",
        justifyContent: collapsed ? "center" : "flex-start",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = SIDEBAR_HOVER_BG;
          e.currentTarget.style.color = SIDEBAR_INK;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = SIDEBAR_MUTE;
        }
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 20,
          height: 20,
        }}
      >
        {icon}
      </span>
      {!collapsed && (
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
      )}
      {active && !collapsed && (
        <span
          aria-hidden
          style={{
            width: 4,
            height: 4,
            background: SIDEBAR_RED,
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
      )}
    </Link>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        background: "transparent",
        border: `1px solid ${SIDEBAR_BORDER}`,
        borderRadius: 4,
        color: SIDEBAR_MUTE,
        cursor: "pointer",
        padding: 0,
        transition: "color 0.12s, background 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = SIDEBAR_INK;
        e.currentTarget.style.background = SIDEBAR_HOVER_BG;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = SIDEBAR_MUTE;
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function SidebarDeadline({
  iso,
  collapsed,
}: {
  iso: string;
  collapsed: boolean;
}) {
  const target = new Date(iso).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = target - now;
  const overdue = diff <= 0;
  // Pulse + red treatment kicks in inside the last 24h.
  const urgent = !overdue && diff < 24 * 60 * 60 * 1000;

  const abs = Math.abs(diff);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((abs % (1000 * 60)) / 1000);

  // Compact form for collapsed sidebar — just the most significant
  // remaining unit so the column stays narrow.
  if (collapsed) {
    const compact = overdue
      ? "!"
      : days > 0
        ? `${days}d`
        : hours > 0
          ? `${hours}h`
          : `${minutes}m`;
    return (
      <div
        title={overdue ? "OVERDUE" : `Deadline in ${days}d ${hours}h ${minutes}m`}
        style={{
          padding: "10px 6px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          color: overdue || urgent ? SIDEBAR_RED : SIDEBAR_INK,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          fontWeight: 600,
          animation: urgent || overdue ? "gprPulse 1.4s ease-in-out infinite" : undefined,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            color: SIDEBAR_MUTE,
          }}
        >
          DUE
        </span>
        <span>{compact}</span>
        <style>{pulseKeyframes}</style>
      </div>
    );
  }

  const color = overdue || urgent ? SIDEBAR_RED : SIDEBAR_INK;

  return (
    <div
      style={{
        padding: "10px 12px 12px",
        margin: "0 4px",
        borderRadius: 8,
        background:
          overdue || urgent ? "rgba(255, 59, 48, 0.08)" : "rgba(255, 255, 255, 0.025)",
        border: `1px solid ${overdue || urgent ? "rgba(255, 59, 48, 0.35)" : SIDEBAR_BORDER}`,
        animation: urgent || overdue ? "gprPulse 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          color: SIDEBAR_MUTE,
          marginBottom: 4,
        }}
      >
        DEADLINE
      </div>
      {overdue ? (
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: SIDEBAR_RED,
            letterSpacing: "0.02em",
          }}
        >
          OVERDUE
        </div>
      ) : (
        <div
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            fontWeight: 600,
            color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {days > 0 && (
            <span>
              {days}d <span style={{ opacity: 0.55 }}>{hours}h</span>{" "}
              <span style={{ opacity: 0.55 }}>{minutes}m</span>
            </span>
          )}
          {days === 0 && hours > 0 && (
            <span>
              {hours}h <span style={{ opacity: 0.55 }}>{minutes}m</span>{" "}
              <span style={{ opacity: 0.4 }}>{String(seconds).padStart(2, "0")}s</span>
            </span>
          )}
          {days === 0 && hours === 0 && (
            <span>
              {minutes}m <span style={{ opacity: 0.55 }}>{String(seconds).padStart(2, "0")}s</span>
            </span>
          )}
        </div>
      )}
      <style>{pulseKeyframes}</style>
    </div>
  );
}

const pulseKeyframes = `
@keyframes gprPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
`;

function ProjectInitial({ name }: { name: string }) {
  const ch = name.trim()[0]?.toUpperCase() ?? "•";
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        background: "rgba(255, 255, 255, 0.06)",
        color: SIDEBAR_INK,
        borderRadius: 3,
      }}
    >
      {ch}
    </span>
  );
}
