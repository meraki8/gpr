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
  assignedTo: string | null;
  targetDate: Date | string | null;
};

type NormalizedEntry = Omit<Entry, "createdAt" | "targetDate"> & {
  createdAt: Date;
  targetDate: Date | null;
};

type DateBucket = "today" | "yesterday" | "thisWeek" | "older";

const SOURCE_FILTERS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "All" },
  { key: KB_SOURCES.TRANSCRIPT, label: "Transcript" },
  { key: KB_SOURCES.GITHUB, label: "GitHub" },
  { key: KB_SOURCES.JIRA, label: "Jira" },
  { key: KB_SOURCES.MANUAL, label: "Manual" },
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

const ENTRY_GRID =
  "minmax(120px, 160px) minmax(0, 1fr) 140px 90px 90px 20px";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfIsoWeek(d: Date): Date {
  const today = startOfDay(d);
  const dow = today.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  today.setDate(today.getDate() - offset);
  return today;
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

// Parse a YYYY-MM-DD value from <input type="date"> as a local-time
// date so range comparisons match what the user sees in the picker.
function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    0,
    0,
    0,
    0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function KnowledgeBaseExplorer({
  entries: rawEntries,
}: {
  entries: Entry[];
}) {
  const entries = useMemo<NormalizedEntry[]>(
    () =>
      rawEntries.map((e) => ({
        ...e,
        createdAt:
          e.createdAt instanceof Date
            ? e.createdAt
            : new Date(e.createdAt),
        targetDate:
          e.targetDate == null
            ? null
            : e.targetDate instanceof Date
              ? e.targetDate
              : new Date(e.targetDate),
      })),
    [rawEntries],
  );

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const now = useMemo(() => new Date(), []);

  // Apply date range filter (from / to inclusive).
  const dateFiltered = useMemo(() => {
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);
    if (!from && !to) return entries;
    return entries.filter((e) => {
      const c = e.createdAt;
      if (from && c < from) return false;
      if (to) {
        // Inclusive end-of-day: bump `to` to next day midnight.
        const toEndExclusive = new Date(to);
        toEndExclusive.setDate(toEndExclusive.getDate() + 1);
        if (c >= toEndExclusive) return false;
      }
      return true;
    });
  }, [entries, fromDate, toDate]);

  const dateAndSearchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.assignedTo?.toLowerCase().includes(q) ?? false),
    );
  }, [dateFiltered, search]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of dateAndSearchFiltered) {
      counts[e.source] = (counts[e.source] ?? 0) + 1;
    }
    return counts;
  }, [dateAndSearchFiltered]);

  const totalAfterDateAndSearch = dateAndSearchFiltered.length;

  const visible = useMemo(() => {
    if (!sourceFilter) return dateAndSearchFiltered;
    return dateAndSearchFiltered.filter((e) => e.source === sourceFilter);
  }, [dateAndSearchFiltered, sourceFilter]);

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

  function clearAllFilters() {
    setSearch("");
    setSourceFilter(null);
    setFromDate("");
    setToDate("");
  }

  function clearDateRange() {
    setFromDate("");
    setToDate("");
  }

  const totalAcrossAll = entries.length;
  const dateRangeActive = !!fromDate || !!toDate;

  return (
    <div>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
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
          placeholder="Search title, content, or assignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Date range */}
      <FilterRow label="Date">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="field num"
          style={{ width: 160, padding: "8px 12px", fontSize: 13 }}
          aria-label="From date"
        />
        <span className="mute-ink" style={{ fontSize: 13 }}>
          →
        </span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="field num"
          style={{ width: 160, padding: "8px 12px", fontSize: 13 }}
          aria-label="To date"
        />
        {dateRangeActive && (
          <button
            type="button"
            onClick={clearDateRange}
            className="pill pill-ghost pill-sm"
          >
            Clear
          </button>
        )}
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

      {/* Column headers */}
      {visible.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: ENTRY_GRID,
            gap: 16,
            padding: "16px 0 8px",
            color: "var(--mute)",
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>Source</span>
          <span>Title</span>
          <span>Assigned to</span>
          <span style={{ textAlign: "right" }}>Target</span>
          <span style={{ textAlign: "right" }}>Created</span>
          <span />
        </div>
      )}

      {/* Timeline */}
      {groups.length === 0 ? (
        <EmptyState
          totalAcrossAll={totalAcrossAll}
          search={search}
          dateRangeActive={dateRangeActive}
          sourceFilter={sourceFilter}
          onClear={clearAllFilters}
        />
      ) : (
        <div>
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
        gap: 10,
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
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
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
    <section style={{ marginTop: 24 }}>
      <h3
        className="label"
        style={{
          margin: "0 0 4px",
          paddingTop: 12,
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

  // Highlight overdue items (target in the past) so they stand out
  // in the tracker view. Today and future use ink; past uses red.
  const targetColor = (() => {
    if (!entry.targetDate) return "var(--mute-2)";
    const today = startOfDay(new Date());
    const target = startOfDay(entry.targetDate);
    if (target < today) return "var(--red)";
    return "var(--ink)";
  })();

  return (
    <article style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: ENTRY_GRID,
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
            fontSize: 14,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--ink)",
          }}
          title={entry.title}
        >
          {entry.title}
        </span>
        <span
          style={{
            fontSize: 13,
            color: entry.assignedTo ? "var(--ink-2)" : "var(--mute-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={entry.assignedTo ?? "Unassigned"}
        >
          {entry.assignedTo ?? "—"}
        </span>
        <span
          className="num"
          style={{
            fontSize: 12,
            color: targetColor,
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {entry.targetDate ? formatDate(entry.targetDate) : "—"}
        </span>
        <span
          className="mute-ink num"
          style={{
            fontSize: 12,
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {formatDate(entry.createdAt)}
        </span>
        <span style={{ color: "var(--mute)", display: "inline-flex" }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && (
        <div
          style={{
            paddingLeft: 0,
            paddingRight: 36,
            paddingBottom: 18,
            paddingTop: 0,
            display: "grid",
            gridTemplateColumns: "minmax(120px, 160px) 1fr",
            gap: 16,
          }}
        >
          <div />
          <div>
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
            {(entry.assignedTo || entry.targetDate) && (
              <div
                className="mute-ink"
                style={{
                  fontSize: 12,
                  marginTop: 10,
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                }}
              >
                {entry.assignedTo && (
                  <span>
                    <strong style={{ color: "var(--ink)" }}>
                      Owner:
                    </strong>{" "}
                    {entry.assignedTo}
                  </span>
                )}
                {entry.targetDate && (
                  <span>
                    <strong style={{ color: "var(--ink)" }}>
                      Target:
                    </strong>{" "}
                    {entry.targetDate.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({
  totalAcrossAll,
  search,
  dateRangeActive,
  sourceFilter,
  onClear,
}: {
  totalAcrossAll: number;
  search: string;
  dateRangeActive: boolean;
  sourceFilter: string | null;
  onClear: () => void;
}) {
  const hasFilter = !!search || dateRangeActive || sourceFilter !== null;

  if (totalAcrossAll === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p className="body" style={{ margin: 0 }}>
          Nothing in the knowledge base yet.
        </p>
        <p className="mute-ink" style={{ fontSize: 13, marginTop: 8 }}>
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
