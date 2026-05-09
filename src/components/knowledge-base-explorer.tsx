"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Search,
  ChevronLeft,
} from "lucide-react";
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
type RangeKey = "today" | "7d" | "30d" | "3m" | "all" | "custom";

type ActiveFilters = {
  range: RangeKey;
  customFrom: string | null;
  customTo: string | null;
  source: string | null;
  q: string;
};

type Props = {
  entries: Entry[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  sourceCounts: Record<string, number>;
  sourceTotal: number;
  activeFilters: ActiveFilters;
};

const SOURCE_FILTERS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "All" },
  { key: KB_SOURCES.TRANSCRIPT, label: "Transcript" },
  { key: KB_SOURCES.GITHUB, label: "GitHub" },
  { key: KB_SOURCES.JIRA, label: "Jira" },
  { key: KB_SOURCES.MANUAL, label: "Manual" },
];

const RANGE_CHIPS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
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

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function KnowledgeBaseExplorer({
  entries: rawEntries,
  totalCount,
  page,
  totalPages,
  pageSize,
  sourceCounts,
  sourceTotal,
  activeFilters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Local search state — debounced into the URL so the user can type
  // without every keystroke causing a server round-trip.
  const [searchInput, setSearchInput] = useState(activeFilters.q);
  useEffect(() => {
    setSearchInput(activeFilters.q);
  }, [activeFilters.q]);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (searchInput === activeFilters.q) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      pushParams({ q: searchInput || null, page: 1 });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Custom range scratch state — only writes to the URL when the
  // user hits Apply.
  const [customFrom, setCustomFrom] = useState(
    activeFilters.customFrom ?? "",
  );
  const [customTo, setCustomTo] = useState(activeFilters.customTo ?? "");
  useEffect(() => {
    setCustomFrom(activeFilters.customFrom ?? "");
    setCustomTo(activeFilters.customTo ?? "");
  }, [activeFilters.customFrom, activeFilters.customTo]);

  const now = useMemo(() => new Date(), []);

  function buildQs(
    overrides: Record<string, string | number | null | undefined>,
  ) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const s = next.toString();
    return s ? `?${s}` : "";
  }

  function pushParams(
    overrides: Record<string, string | number | null | undefined>,
  ) {
    const url = `${pathname}${buildQs(overrides)}`;
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  function setRange(key: RangeKey) {
    if (key === "custom") {
      // Switching to custom keeps existing custom from/to in the URL
      // if they're already set; otherwise blanks them so the inputs
      // open empty.
      pushParams({ range: "custom", page: 1 });
    } else {
      pushParams({
        range: key,
        from: null,
        to: null,
        page: 1,
      });
    }
  }

  function applyCustom() {
    if (!customFrom && !customTo) return;
    pushParams({
      range: "custom",
      from: customFrom || null,
      to: customTo || null,
      page: 1,
    });
  }

  function setSource(key: string | null) {
    pushParams({ source: key, page: 1 });
  }

  function clearAllFilters() {
    pushParams({
      range: null,
      from: null,
      to: null,
      source: null,
      q: null,
      page: 1,
    });
  }

  const explorerRef = useRef<HTMLDivElement | null>(null);
  function goToPage(target: number) {
    const clamped = Math.max(1, Math.min(totalPages, target));
    if (clamped === page) return;
    pushParams({ page: clamped });
    // Scroll the explorer into view so the user lands at the top of
    // the list rather than wherever they were on the page before.
    requestAnimationFrame(() => {
      explorerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Group visible entries within the current page by bucket.
  const groups = useMemo(() => {
    const order: DateBucket[] = ["today", "yesterday", "thisWeek", "older"];
    const map = new Map<DateBucket, NormalizedEntry[]>();
    for (const e of entries) {
      const b = bucketOf(e.createdAt, now);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(e);
    }
    return order
      .filter((b) => map.has(b))
      .map((b) => ({ bucket: b, entries: map.get(b)! }));
  }, [entries, now]);

  const hasFilter =
    activeFilters.range !== "all" ||
    !!activeFilters.source ||
    !!activeFilters.q;

  return (
    <div ref={explorerRef} style={{ opacity: pending ? 0.7 : 1 }}>
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="field"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Date range — quick chips + custom */}
      <FilterRow label="Date">
        {RANGE_CHIPS.map((c) => (
          <Chip
            key={c.key}
            active={activeFilters.range === c.key}
            onClick={() => setRange(c.key)}
          >
            {c.label}
          </Chip>
        ))}
      </FilterRow>

      {activeFilters.range === "custom" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
            paddingLeft: 70,
          }}
        >
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="field num"
            style={{ width: 160, padding: "8px 12px", fontSize: 13 }}
            aria-label="From date"
          />
          <span className="mute-ink" style={{ fontSize: 13 }}>
            →
          </span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="field num"
            style={{ width: 160, padding: "8px 12px", fontSize: 13 }}
            aria-label="To date"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="pill pill-sm"
            disabled={!customFrom && !customTo}
          >
            Apply →
          </button>
        </div>
      )}

      {/* Source filter */}
      <FilterRow label="Source">
        {SOURCE_FILTERS.map((f) => {
          const active = activeFilters.source === f.key;
          const count = f.key
            ? (sourceCounts[f.key] ?? 0)
            : sourceTotal;
          return (
            <Chip
              key={f.label}
              active={active}
              onClick={() => setSource(f.key)}
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
      {entries.length > 0 && (
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
      {entries.length === 0 ? (
        <EmptyState
          totalCount={totalCount}
          hasFilter={hasFilter}
          q={activeFilters.q}
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

      {/* Pagination */}
      {totalCount > 0 && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPage={goToPage}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPage: (n: number) => void;
}) {
  const [jumpInput, setJumpInput] = useState(String(page));
  useEffect(() => {
    setJumpInput(String(page));
  }, [page]);

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div className="mute-ink" style={{ fontSize: 13 }}>
        <span className="num">{start}</span>–<span className="num">{end}</span>{" "}
        of <span className="num">{totalCount}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="pill pill-ghost pill-sm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: page <= 1 ? 0.45 : 1,
          }}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <span
          className="num"
          style={{
            fontSize: 13,
            color: "var(--ink)",
            padding: "0 6px",
            whiteSpace: "nowrap",
          }}
        >
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="pill pill-ghost pill-sm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: page >= totalPages ? 0.45 : 1,
          }}
        >
          Next
          <ChevronRight size={14} />
        </button>

        {totalPages > 5 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jumpInput);
              if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
                onPage(n);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginLeft: 8,
            }}
          >
            <span
              className="mute-ink"
              style={{ fontSize: 12, letterSpacing: "0.04em" }}
            >
              Go to
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="field num"
              style={{
                width: 64,
                padding: "6px 10px",
                fontSize: 13,
              }}
              aria-label="Jump to page"
            />
            <button type="submit" className="pill pill-ghost pill-sm">
              Go
            </button>
          </form>
        )}
      </div>
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
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
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
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={active ? "pill pill-sm" : "pill pill-ghost pill-sm"}
      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
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
  totalCount,
  hasFilter,
  q,
  onClear,
}: {
  totalCount: number;
  hasFilter: boolean;
  q: string;
  onClear: () => void;
}) {
  if (totalCount === 0 && !hasFilter) {
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

  if (q) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p className="body" style={{ margin: 0 }}>
          No entries match &ldquo;{q}&rdquo;.
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
