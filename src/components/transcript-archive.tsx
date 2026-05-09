"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormatBadge } from "@/components/format-badge";

type Transcript = {
  id: string;
  title: string | null;
  meetingAt: Date | string | null;
  createdAt: Date | string;
  source: string;
  sourceFormat: string | null;
  kbEntryCount: number;
  uploaderId: string;
  uploader: { name: string | null; email: string };
  matchReports: { id: string }[];
};

type Props = {
  projectId: string;
  transcripts: Transcript[];
  viewerId: string;
};

type FilterKey = "all" | "week" | "month" | "me";
type SortKey = "newest" | "oldest";

const PAGE_SIZE = 10;

const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "me", label: "By me" },
];

const TITLE_LIMIT = 40;

export function TranscriptArchive({
  projectId,
  transcripts,
  viewerId,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  // Normalize once.
  const normalized = useMemo(
    () =>
      transcripts.map((t) => ({
        ...t,
        meetingAt:
          t.meetingAt == null
            ? null
            : t.meetingAt instanceof Date
              ? t.meetingAt
              : new Date(t.meetingAt),
        createdAt:
          t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
      })),
    [transcripts],
  );

  // Filter + search + sort.
  const view = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const month = 30 * 24 * 60 * 60 * 1000;
    const q = search.trim().toLowerCase();

    const filtered = normalized.filter((t) => {
      const when = (t.meetingAt ?? t.createdAt) as Date;
      if (filter === "week" && now - when.getTime() > week) return false;
      if (filter === "month" && now - when.getTime() > month) return false;
      if (filter === "me" && t.uploaderId !== viewerId) return false;
      if (q.length > 0) {
        const title = (t.title ?? "").toLowerCase();
        const uploader =
          `${t.uploader.name ?? ""} ${t.uploader.email}`.toLowerCase();
        if (!title.includes(q) && !uploader.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const aT = ((a.meetingAt ?? a.createdAt) as Date).getTime();
      const bT = ((b.meetingAt ?? b.createdAt) as Date).getTime();
      return sort === "newest" ? bT - aT : aT - bT;
    });

    return filtered;
  }, [normalized, filter, search, sort, viewerId]);

  // Reset to page 1 whenever filter inputs change.
  useEffect(() => {
    setPage(1);
  }, [filter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = view.slice(pageStart, pageStart + PAGE_SIZE);

  if (transcripts.length === 0) return null;

  return (
    <section style={{ paddingTop: 40 }}>
      <div className="label" style={{ marginBottom: 18 }}>
        Archive · {transcripts.length} transcript
        {transcripts.length === 1 ? "" : "s"}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search
          size={14}
          color="var(--mute)"
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Search by title or uploader…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Filter chips + sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTER_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={
                filter === c.key
                  ? "pill pill-sm"
                  : "pill pill-ghost pill-sm"
              }
              style={{ cursor: "pointer" }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="field num"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              minWidth: 140,
            }}
            aria-label="Sort"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "150px minmax(0, 1fr) 180px 70px 70px 70px",
          gap: 16,
          padding: "10px 14px",
          color: "var(--mute)",
          fontSize: 11,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span>Date</span>
        <span>Title</span>
        <span>Uploaded by</span>
        <span>Source</span>
        <span style={{ textAlign: "right" }}>KB</span>
        <span />
      </div>

      {pageItems.length === 0 ? (
        <div
          className="mute-ink"
          style={{ padding: "32px 14px", fontSize: 13, textAlign: "center" }}
        >
          No transcripts match this view.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {pageItems.map((t) => {
            const report = t.matchReports[0];
            const when = (t.meetingAt ?? t.createdAt) as Date;
            const fallback = `Meeting · ${when.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}`;
            const display = t.title ?? fallback;
            const truncated =
              display.length > TITLE_LIMIT
                ? `${display.slice(0, TITLE_LIMIT - 1)}…`
                : display;
            const clickable = !!report;
            return (
              <li
                key={t.id}
                onClick={() => {
                  if (clickable) {
                    router.push(
                      `/projects/${projectId}/reports/${report.id}`,
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && clickable) {
                    e.preventDefault();
                    router.push(
                      `/projects/${projectId}/reports/${report.id}`,
                    );
                  }
                }}
                tabIndex={clickable ? 0 : -1}
                role={clickable ? "link" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "150px minmax(0, 1fr) 180px 70px 70px 70px",
                  gap: 16,
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--line-2)",
                  alignItems: "center",
                  cursor: clickable ? "pointer" : "default",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (clickable) {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--ink) 4%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                <span
                  className="num"
                  style={{
                    fontSize: 13,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                  }}
                  title={when.toLocaleString()}
                >
                  {compactDate(when)}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={display}
                  >
                    {truncated}
                  </span>
                  <FormatBadge format={t.sourceFormat} />
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <Avatar uploader={t.uploader} />
                  <span
                    className="mute-ink"
                    style={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.uploader.name ??
                      t.uploader.email.split("@")[0]}
                  </span>
                </span>
                <span>
                  <SourceBadge source={t.source} />
                </span>
                <span
                  className="num"
                  style={{
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      t.kbEntryCount > 0
                        ? "var(--ink)"
                        : "var(--mute-2, var(--mute))",
                  }}
                >
                  {t.kbEntryCount || "—"}
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span
                    className={
                      clickable ? "pill pill-ghost pill-sm" : "mute-ink"
                    }
                    style={{
                      fontSize: 12,
                      pointerEvents: "none",
                    }}
                  >
                    {clickable ? "View" : "—"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {view.length > PAGE_SIZE && (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div className="mute-ink" style={{ fontSize: 12 }}>
            <span className="num">{pageStart + 1}</span>–
            <span className="num">
              {Math.min(pageStart + PAGE_SIZE, view.length)}
            </span>{" "}
            of <span className="num">{view.length}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="pill pill-ghost pill-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                opacity: safePage <= 1 ? 0.45 : 1,
              }}
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span
              className="num"
              style={{ fontSize: 12, color: "var(--ink)" }}
            >
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={safePage >= totalPages}
              className="pill pill-ghost pill-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                opacity: safePage >= totalPages ? 0.45 : 1,
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function compactDate(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SourceBadge({ source }: { source: string }) {
  const isFile = source.toLowerCase() === "file";
  const label = isFile ? "FILE" : "PASTE";
  const color = isFile ? "var(--red)" : "var(--ink)";
  return (
    <span
      className="num"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        border: `1px solid ${color}`,
        color,
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Avatar({
  uploader,
}: {
  uploader: { name: string | null; email: string };
}) {
  const display = uploader.name ?? uploader.email;
  const initial = display.trim()[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 999,
        background: "var(--ink)",
        color: "var(--bg)",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}
