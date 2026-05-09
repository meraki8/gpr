import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getMatchReport } from "@/lib/data";

const CARD_STYLES: Record<string, { label: string; classes: string }> = {
  YELLOW: {
    label: "Yellow card",
    classes: "bg-yellow-500/10 border-yellow-500/40 text-yellow-300",
  },
  RED: {
    label: "Red card",
    classes: "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]",
  },
  MVP: {
    label: "MVP",
    classes: "bg-white/10 border-white/30 text-white",
  },
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const report = await getMatchReport(reportId);

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        <Link
          href={`/projects/${projectId}`}
          className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/60 mb-4 inline-block"
        >
          ← {report.project.name}
        </Link>
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Match Report ·{" "}
          <span className="text-white/50">{report.status}</span>
        </p>
        <h1 className="text-4xl font-bold mb-4">
          {report.createdAt.toLocaleString()}
        </h1>
        <p className="text-white/80 max-w-3xl mb-12 text-lg leading-relaxed">
          {report.summary}
        </p>

        <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
          Member breakdown
        </h2>
        <ul className="grid gap-3 mb-12">
          {report.memberReports.map((mr) => (
            <li
              key={mr.id}
              className="border border-white/10 bg-white/5 px-5 py-4"
            >
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-medium">
                  {mr.user.name ?? mr.user.email}
                </div>
                <div className="flex items-baseline gap-4 font-mono text-sm">
                  <span className="text-white/40 text-xs uppercase">
                    score
                  </span>
                  <span className="text-2xl font-bold text-[#DC2626]">
                    {mr.contributionScore}
                  </span>
                  {mr.speakingTimePct !== null && (
                    <span className="text-white/50 text-xs">
                      {mr.speakingTimePct.toFixed(0)}% talk time
                    </span>
                  )}
                </div>
              </div>
              {mr.notes && (
                <p className="text-sm text-white/70 mb-3">{mr.notes}</p>
              )}
              {Array.isArray(mr.commitmentsJson) &&
                mr.commitmentsJson.length > 0 && (
                  <div className="border-t border-white/10 mt-3 pt-3">
                    <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">
                      Commitments
                    </div>
                    <ul className="space-y-2 text-sm">
                      {(mr.commitmentsJson as Array<{
                        text: string;
                        due_date_iso: string | null;
                        source_quote: string;
                      }>).map((c, i) => (
                        <li key={i} className="text-white/70">
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

        <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
          Cards · {report.cards.length} draft
          {report.cards.length === 1 ? "" : "s"}
        </h2>
        {report.cards.length === 0 ? (
          <p className="text-white/50 italic mb-12">
            No cards drafted for this meeting.
          </p>
        ) : (
          <ul className="grid gap-3 mb-12">
            {report.cards.map((card) => {
              const style =
                CARD_STYLES[card.cardType] ?? CARD_STYLES.YELLOW;
              return (
                <li
                  key={card.id}
                  className={`border px-5 py-4 ${style.classes}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-xs uppercase tracking-widest">
                      {style.label}
                    </div>
                    <div className="text-xs font-mono opacity-70">
                      {card.user.name ?? card.user.email} · {card.status}
                    </div>
                  </div>
                  <p className="text-sm">{card.reason}</p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-white/10 pt-8">
          <div className="border border-dashed border-white/20 px-6 py-12 text-center">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 mb-2">
              Phase 5
            </p>
            <p className="text-white/60">
              Draft-card approval flow + dramatic Match Report styling lands
              here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
