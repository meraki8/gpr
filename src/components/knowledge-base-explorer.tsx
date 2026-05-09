"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { KB_SOURCES } from "@/lib/kb";

type Entry = {
  id: string;
  source: string;
  sourceTypeLabel: string | null;
  title: string;
  content: string;
  createdAt: Date | string;
};

type NormalizedEntry = Omit<Entry, "createdAt"> & { createdAt: Date };

type DateBucket = "today" | "yesterday" | "thisWeek" | "older";
type DateFilter = "today" | "week" | "month" | "all";

const SOURCE_FILTERS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "All" },
  { key: KB_SOURCES.TRANSCRIPT, label: "Transcript" },
  { key: KB_SOURCES.GITHUB, label: "GitHub" },
  { key: KB_SOURCES.JIRA, label: "Jira" },
  { key: KB_SOURCES.MANUAL, label: "Manual" },
];

const DATE_FILTERS: Array<{ key: DateFilter; label: string }> = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const SOURCE_BADGE_COLOR: Record<string, string> = {
  transcript: "var(--red)",
  github: "var(--ink)",
  jira: "var(--ink)",
  manual: "var(--mute)",
};

const BUCKET_LABEL: Record<DateBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "Earlier this week",
  older: "Older",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ISO-week start: Monday 00:00 of the week containing `d` in local time.
function startOfIsoWeek(d: Date): Date {
  const today = startOfDay(d);
  const dow = today.getDay(); // 0 = Sun … 6 = Sat
  const offset = dow === 0 ? 6 : dow - 1;
  today.setDate(today.getDate() - offset);
  return today;
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function bucketOf(date: Date, now: Date): DateBucket {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = startOfIsoWeek(now);

  if (date >= todayStart) return "today";
  if (date >= yesterdayStart) return "yesterday";
  if (date >= weekStart) return "thisWeek";
  return "older";
}

function matchesDateFilter(date: Date, filter: DateFilter, now: Date) {
  if (filter === "all") return true;
  if (filter === "today") return date >= startOfDay(now);
  if (filter === "week") return date >= startOfIsoWeek(now);
  if (filter === "month") return date >= startOfMonth(now);
  return true;
}

export function KnowledgeBaseExplorer({
  entries: rawEntries,
}: {
  entries: Entry[];
}) {
  // Materialize Date objects once so all the comparisons below avoid
  // repeated string parsing.
  const entries = useMemo<NormalizedEntry[]>(
    () =>
      rawEntries.map((e) => ({
        ...e,
        createdAt:
          e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt),
      })),
    [rawEntries],
  );

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // "Now" only needs to be computed once per render; date math
  // depends on it transitively through useMemo.
  const now = useMemo(() => new Date(), []);

  // Apply date filter first — drives the source-chip counts so they
  // reflect the current view.
  const dateFiltered = useMemo(
    () => entries.filter((e) => matchesDateFilter(e.createdAt, dateFilter, now)),
    [entries, dateFilter, now],
  );

  // Apply search next — also reflected in source counts so users
  // see exactly how many of their search results live in each source.
  const dateAndSearchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q),
    );
  }, [dateFiltered, search]);

  // Source chip counts are dynamic against (date + search) — but the
  // chip totals don't include the source filter itself (otherwise the
  // selected chip would always read "all entries").
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of dateAndSearchFiltered) {
      counts[e.source] = (counts[e.source] ?? 0) + 1;
    }
    return counts;
  }, [dateAndSearchFiltered]);

  const totalAfterDateAndSearch = dateAndSearchFiltered.length;

  // Final list applies the source filter on top.
  const visible = useMemo(() => {
    if (!sourceFilter) return dateAndSearchFiltered;
    return dateAndSearchFiltered.filter((e) => e.source === sourceFilter);
  }, [dateAndSearchFiltered, sourceFilter]);

  // Group into date buckets for the timeline.
  const groups = useMemo(() => {
    const order: DateBucket[] = ["today", "yesterday", "thisWeek", "older"];
    const map = new Map<DateBucket, NormalizedEntry[]>();
    for (const e of visible) {
      const b = bucketOf(e.createdAt, now);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(e);
    }
    return order
      .filter((b) => map.has(b))
      .map((b) => ({ bucket: b, entries: map.get(b)! }));
  }, [visible, now]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalAcrossAll = entries.length;

  return (
    <div>
      {/* Search */}
      <div
        style={{
          position: "relative",
          marginBottom: 20,
        }}
      >
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
          placeholder="Search titles and content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Date filter */}
      <FilterRow label="When">
        {DATE_FILTERS.map((f) => (
          <Chip
            key={f.key}
            active={dateFilter === f.key}
            onClick={() => setDateFilter(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </FilterRow>

      {/* Source filter */}
      <FilterRow label="Source">
        {SOURCE_FILTERS.map((f) => {
          const active = sourceFilter === f.key;
          const count = f.key
            ? (sourceCounts[f.key] ?? 0)
            : totalAfterDateAndSearch;
          return (
            <Chip
              key={f.label}
              active={active}
              onClick={() => setSourceFilter(f.key)}
            >
              {f.label}{" "}
              <span
                className="num"
                style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}
              >
                {count}
              </span>
            </Chip>
          );
        })}
      </FilterRow>

      {/* Timeline */}
      {groups.length === 0 ? (
        <EmptyState
          totalAcrossAll={totalAcrossAll}
          search={search}
          dateFilter={dateFilter}
          sourceFilter={sourceFilter}
          onClear={() => {
            setSearch("");
            setSourceFilter(null);
            setDateFilter("all");
          }}
        />
      ) : (
        <div style={{ marginTop: 8 }}>
          {groups.map((g) => (
            <DateGroupSection key={g.bucket} title={BUCKET_LABEL[g.bucket]}>
              {g.entries.map((e) => (
                <EntryAccordion
                  key={e.id}
                  entry={e}
                  open={expanded.has(e.id)}
                  onToggle={() => toggleExpanded(e.id)}
                />
              ))}
            </DateGroupSection>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <span
        className="label"
        style={{ minWidth: 60, color: "var(--mute)" }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "pill pill-sm" : "pill pill-ghost pill-sm"}
      style={{ cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function DateGroupSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h3
        className="label"
        style={{
          margin: "0 0 8px",
          paddingBottom: 8,
          borderBottom: "1px solid var(--line-2)",
          color: "var(--mute)",
        }}
      >
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function EntryAccordion({
  entry,
  open,
  onToggle,
}: {
  entry: NormalizedEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const color = SOURCE_BADGE_COLOR[entry.source] ?? "var(--ink)";
  const badgeText = entry.sourceTypeLabel
    ? `${entry.source} · ${entry.sourceTypeLabel}`
    : entry.source;

  return (
    <article
      style={{
        borderBottom: "1px solid var(--line)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "150px 1fr 110px 20px",
          gap: 16,
          alignItems: "center",
          padding: "16px 0",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          color: "inherit",
        }}
      >
        <span
          className="label"
          style={{
            color,
            fontSize: 11,
            letterSpacing: "0.06em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={badgeText}
        >
          {badgeText}
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--ink)",
          }}
        >
          {entry.title}
        </span>
        <span
          className="mute-ink num"
          style={{
            fontSize: 12,
            textAlign: "right",
          }}
        >
          {entry.createdAt.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {entry.createdAt.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span style={{ color: "var(--mute)", display: "inline-flex" }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && (
        <div
          style={{
            paddingLeft: 166,
            paddingBottom: 18,
            paddingTop: 0,
          }}
        >
          <div
            className="body"
            style={{
              fontSize: 14,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--ink-2)",
              maxWidth: 760,
            }}
          >
            {entry.content}
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({
  totalAcrossAll,
  search,
  dateFilter,
  sourceFilter,
  onClear,
}: {
  totalAcrossAll: number;
  search: string;
  dateFilter: DateFilter;
  sourceFilter: string | null;
  onClear: () => void;
}) {
  const hasFilter =
    !!search || dateFilter !== "all" || sourceFilter !== null;

  if (totalAcrossAll === 0) {
    return (
      <div
        style={{
          padding: "60px 0",
          textAlign: "center",
        }}
      >
        <p className="body" style={{ margin: 0 }}>
          Nothing in the knowledge base yet.
        </p>
        <p
          className="mute-ink"
          style={{ fontSize: 13, marginTop: 8 }}
        >
          Run a transcript analysis, sync GitHub, or add a manual note
          above to start building it up.
        </p>
      </div>
    );
  }

  if (search) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p className="body" style={{ margin: 0 }}>
          No entries match &ldquo;{search}&rdquo;.
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={onClear}
            className="pill pill-ghost pill-sm"
            style={{ marginTop: 16 }}
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <p className="body" style={{ margin: 0 }}>
        No entries in this view.
      </p>
      <p className="mute-ink" style={{ fontSize: 13, marginTop: 8 }}>
        Try widening the date range or picking a different source.
      </p>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="pill pill-ghost pill-sm"
          style={{ marginTop: 16 }}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
