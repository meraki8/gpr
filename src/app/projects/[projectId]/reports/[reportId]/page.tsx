import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getMatchReport } from "@/lib/data";
import { approveCard, dismissCard, publishReport } from "./actions";

const CARD_THEME: Record<
  string,
  { label: string; chip: string; border: string }
> = {
  YELLOW: {
    label: "Yellow",
    chip: "bg-yellow-400 text-black",
    border: "border-l-yellow-400",
  },
  RED: {
    label: "Red",
    chip: "bg-[#DC2626] text-white",
    border: "border-l-[#DC2626]",
  },
  MVP: {
    label: "MVP",
    chip: "bg-white text-black",
    border: "border-l-white",
  },
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  APPROVED: "bg-emerald-500/20 text-emerald-300",
  DISMISSED: "bg-white/5 text-white/30",
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const report = await getMatchReport(reportId);
  const top = report.memberReports[0];
  const draftCardCount = report.cards.filter((c) => c.status === "DRAFT").length;

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />

      {/* Hero band */}
      <section className="px-8 py-20 border-b border-white/10 bg-gradient-to-b from-[#DC2626]/10 via-transparent to-transparent">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/projects/${projectId}`}
            className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/60 inline-block"
          >
            ← {report.project.name}
          </Link>
          <div className="flex items-center gap-3 mt-6 mb-2">
            <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase">
              Match Report
            </p>
            <span
              className={`font-mono text-xs uppercase tracking-widest px-2 py-1 ${
                report.status === "PUBLISHED"
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {report.status}
            </span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-none mb-8">
            {report.createdAt.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl leading-relaxed font-light">
            {report.summary}
          </p>

          {report.isOwner && report.status === "DRAFT" && (
            <div className="mt-10 flex items-center gap-4 flex-wrap">
              <form action={publishReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="bg-[#DC2626] text-white px-6 py-3 font-medium hover:bg-[#B91C1C] transition"
                >
                  Publish to team
                </button>
              </form>
              <p className="text-xs text-white/50 font-mono">
                {draftCardCount > 0
                  ? `${draftCardCount} draft card${draftCardCount === 1 ? "" : "s"} still pending — approve or dismiss below first.`
                  : "Team will see this report and only approved cards."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Top scorer callout */}
      {top && (
        <section className="px-8 py-16 border-b border-white/10">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-3">
              Top contributor
            </p>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="text-4xl md:text-5xl font-black">
                {top.user.name ?? top.user.email}
              </h2>
              <div className="font-mono text-7xl md:text-9xl font-black text-[#DC2626] leading-none">
                {top.contributionScore}
              </div>
            </div>
            {top.notes && (
              <p className="text-white/60 mt-4 max-w-2xl">{top.notes}</p>
            )}
          </div>
        </section>
      )}

      {/* Full member breakdown */}
      <section className="px-8 py-16 border-b border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-6">
            Full breakdown
          </h2>
          <ul className="grid gap-3">
            {report.memberReports.map((mr) => (
              <li
                key={mr.id}
                className="border border-white/10 bg-white/5 px-5 py-4"
              >
                <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                  <div className="font-medium">
                    {mr.user.name ?? mr.user.email}
                  </div>
                  <div className="flex items-baseline gap-4 font-mono text-sm">
                    {mr.speakingTimePct !== null && (
                      <span className="text-white/40 text-xs">
                        {mr.speakingTimePct.toFixed(0)}% talk
                      </span>
                    )}
                    <span className="text-white/40 text-xs uppercase">
                      score
                    </span>
                    <span className="text-3xl font-black text-[#DC2626]">
                      {mr.contributionScore}
                    </span>
                  </div>
                </div>
                {mr.notes && (
                  <p className="text-sm text-white/70 mb-3">{mr.notes}</p>
                )}
                {Array.isArray(mr.commitmentsJson) &&
                  mr.commitmentsJson.length > 0 && (
                    <div className="border-t border-white/10 mt-3 pt-3">
                      <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">
                        Commitments ({mr.commitmentsJson.length})
                      </div>
                      <ul className="space-y-3 text-sm">
                        {(mr.commitmentsJson as Array<{
                          text: string;
                          due_date_iso: string | null;
                          source_quote: string;
                        }>).map((c, i) => (
                          <li key={i} className="text-white/80">
                            <div>
                              {c.text}
                              {c.due_date_iso && (
                                <span className="text-white/40 font-mono ml-2 text-xs">
                                  due{" "}
                                  {new Date(c.due_date_iso).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="text-white/40 italic mt-1">
                              &ldquo;{c.source_quote}&rdquo;
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cards */}
      <section className="px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-6">
            Cards
            {report.isOwner && draftCardCount > 0 && (
              <span className="text-[#DC2626] ml-3">
                · {draftCardCount} pending review
              </span>
            )}
          </h2>
          {report.cards.length === 0 ? (
            <p className="text-white/50 italic">
              {report.isOwner
                ? "No cards drafted for this meeting."
                : "No approved cards for this meeting."}
            </p>
          ) : (
            <ul className="grid gap-3">
              {report.cards.map((card) => {
                const theme = CARD_THEME[card.cardType] ?? CARD_THEME.YELLOW;
                const showActions =
                  report.isOwner && card.status === "DRAFT";
                return (
                  <li
                    key={card.id}
                    className={`border border-white/10 border-l-4 ${theme.border} bg-white/5 px-5 py-5`}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`shrink-0 w-12 h-16 ${theme.chip} flex items-center justify-center font-black text-[10px] uppercase tracking-widest`}
                      >
                        {theme.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                          <div className="font-medium">
                            {card.user.name ?? card.user.email}
                          </div>
                          <span
                            className={`font-mono text-xs uppercase tracking-widest px-2 py-0.5 ${
                              STATUS_BADGE[card.status] ?? STATUS_BADGE.DRAFT
                            }`}
                          >
                            {card.status}
                          </span>
                        </div>
                        <p className="text-sm text-white/80">{card.reason}</p>
                        {showActions && (
                          <div className="flex gap-2 mt-4">
                            <form action={approveCard}>
                              <input
                                type="hidden"
                                name="cardId"
                                value={card.id}
                              />
                              <button
                                type="submit"
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-4 py-1.5 text-sm font-medium transition"
                              >
                                Approve
                              </button>
                            </form>
                            <form action={dismissCard}>
                              <input
                                type="hidden"
                                name="cardId"
                                value={card.id}
                              />
                              <button
                                type="submit"
                                className="bg-white/5 hover:bg-white/10 text-white/60 px-4 py-1.5 text-sm font-medium transition"
                              >
                                Dismiss
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
