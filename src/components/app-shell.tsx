"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

type Group = { id: string; name: string };

export type AppShellProject = {
  id: string;
  name: string;
  group: Group;
};

export function AppShell({
  user,
  groups,
  currentProject,
  currentGroupId,
  children,
}: {
  user: { name: string | null; email: string };
  groups: Group[];
  currentProject?: AppShellProject | null;
  currentGroupId?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const inProjectContext = !!currentProject;

  return (
    <div className="flex flex-1 min-h-0">
      <aside
        className="shrink-0 sticky top-0 self-start hidden md:flex flex-col"
        style={{
          width: 240,
          height: "100vh",
          borderRight: "1px solid var(--line)",
          padding: "24px 18px 24px 24px",
        }}
      >
        <Link href="/dashboard" className="mb-10 inline-flex">
          <Wordmark />
        </Link>

        <nav
          className="flex flex-col mb-8"
          style={{ gap: 2, minWidth: 0 }}
        >
          <SidebarItem
            href="/dashboard"
            label="Dashboard"
            active={isDashboard}
          />
        </nav>

        <div className="label" style={{ paddingLeft: 16, marginBottom: 10 }}>
          Groups
        </div>
        <nav
          className="flex flex-col mb-8"
          style={{ gap: 2, minWidth: 0 }}
        >
          {groups.length === 0 ? (
            <span
              className="mute-ink"
              style={{ fontSize: 13, paddingLeft: 16 }}
            >
              —
            </span>
          ) : (
            groups.map((g) => {
              const groupActive =
                currentGroupId === g.id ||
                currentProject?.group.id === g.id;
              return (
                <SidebarItem
                  key={g.id}
                  href={`/groups/${g.id}`}
                  label={g.name}
                  active={!!groupActive}
                />
              );
            })
          )}
        </nav>

        {inProjectContext && currentProject && (
          <>
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
              className="flex flex-col mb-8"
              style={{ gap: 2, minWidth: 0 }}
            >
              <SidebarItem
                href={`/projects/${currentProject.id}`}
                label="Overview"
                active={pathname === `/projects/${currentProject.id}`}
              />
              <SidebarItem
                href={`/projects/${currentProject.id}/sources`}
                label="Sources"
                active={pathname === `/projects/${currentProject.id}/sources`}
              />
            </nav>
          </>
        )}

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
