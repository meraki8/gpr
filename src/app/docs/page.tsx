import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "Docs — GPR",
  description: "How to use GPR end to end.",
};

type DocItem = {
  title: string;
  detail: string;
};

type DocSection = {
  number: string;
  label: string;
  title: string;
  intro: string;
  items: DocItem[];
};

const sections: DocSection[] = [
  {
    number: "01",
    label: "Getting started",
    title: "Set up your first project.",
    intro:
      "GPR sits on top of how your team already works. Five minutes from sign-up to your first match report.",
    items: [
      {
        title: "Create an account",
        detail:
          "Sign up with your email via Clerk. No password to manage — magic link or OTP is enough.",
      },
      {
        title: "Create a group",
        detail:
          "A group is the workspace that holds your projects. You can have a personal group, a course group, a startup — whatever shape your work takes.",
      },
      {
        title: "Create a project",
        detail:
          "Inside a group, spin up a project. Give it a name, a brief, and a deadline. Everything else hangs off this row.",
      },
      {
        title: "Invite your team",
        detail:
          "Invite teammates by email from the project's Members tab. They get a 7-day accept link. Once they sign in, they land directly in the project.",
      },
    ],
  },
  {
    number: "02",
    label: "Transcript analysis",
    title: "From transcript to verdict in 20 seconds.",
    intro:
      "Drop in any meeting transcript. GPR reads who said what, extracts every commitment, and scores every member.",
    items: [
      {
        title: "Supported formats",
        detail:
          "Zoom auto-transcripts, Discord exports, Slack exports, WhatsApp chat exports, email threads, and any plain-text or PDF transcript. The format is auto-detected.",
      },
      {
        title: "How to upload",
        detail:
          "Open Transcripts on a project. Either paste the text directly or drop a .txt or .pdf file into the upload zone. One transcript per analysis.",
      },
      {
        title: "What GPR extracts",
        detail:
          "Per-member contribution scores out of 100, draft cards (yellow / red / MVP), commitments quoted verbatim with speakers and target dates, and a summary that becomes the meeting's match report.",
      },
      {
        title: "How long it takes",
        detail:
          "Most transcripts come back in 10–30 seconds. The Transcripts page shows progress and surfaces a notification when the report is ready.",
      },
    ],
  },
  {
    number: "03",
    label: "Match reports",
    title: "Every meeting, on the record.",
    intro:
      "A match report is the after-action document for a single meeting. It's permanent, citeable, and visible to everyone on the project.",
    items: [
      {
        title: "What a report contains",
        detail:
          "A team summary, per-member scores with reasoning, the cards issued in this meeting, every extracted commitment with its source quote, and the source-format badge so you know which transcript the report came from.",
      },
      {
        title: "Yellow card",
        detail:
          "Falling behind. Vague commitments, tickets going stale, repeated late deliveries. The team sees the call.",
      },
      {
        title: "Red card",
        detail:
          "Ghosting or overdue without notice. No-shows, missed deadlines, deliverables silent for days.",
      },
      {
        title: "MVP",
        detail:
          "The contributor carrying the meeting. One per report when warranted — never forced.",
      },
      {
        title: "How scores are calculated",
        detail:
          "Each member starts at a baseline and is adjusted by speaking-time share, the weight and clarity of their commitments, and any cards issued. Scores are honest by design — silent members score low.",
      },
    ],
  },
  {
    number: "04",
    label: "Knowledge base",
    title: "The project's memory.",
    intro:
      "Every commitment, decision, GitHub event, and Jira ticket lands in one searchable, filterable place — citable by source.",
    items: [
      {
        title: "What gets added automatically",
        detail:
          "Logistics decisions, owned commitments, scope changes, blockers, GitHub commits and PRs, and Jira tickets — all from your real activity, with the speaker or actor attached.",
      },
      {
        title: "Add manual entries",
        detail:
          "On the Knowledge Base page, hit Add entry and write anything important the AI missed — design pivots, brief updates, decisions made offline.",
      },
      {
        title: "Search and filter",
        detail:
          "Free-text search across every entry. Filter by source (transcript / GitHub / Jira / manual), by assigned member, or by date range. Server-paginated for large projects.",
      },
      {
        title: "Used by Ask GPR",
        detail:
          "Every entry feeds the chatbot's context window. The KB is the only thing Ask GPR knows about your project.",
      },
    ],
  },
  {
    number: "05",
    label: "Ask GPR",
    title: "A chatbot that only knows your project.",
    intro:
      "Open the panel from any project page. Ask anything grounded in this project's brief, knowledge base, and Jira board.",
    items: [
      {
        title: "What it knows",
        detail:
          "Only your project. The brief, every match report, every KB entry, every connected Jira ticket, and your own role / score / cards as the viewer. No leakage from other projects, no general internet knowledge.",
      },
      {
        title: "What it cannot answer",
        detail:
          "Anything outside your project. If the answer isn't in the KB or brief it will say so explicitly rather than guessing. Citations point back to the [KB-N] or [JIRA-N] entry it pulled from.",
      },
      {
        title: "How to clear the session",
        detail:
          "Hit the rotate icon in the panel header to start a new chat. Otherwise sessions persist for 7 days per device, per project — useful for picking up where you left off without re-explaining context.",
      },
    ],
  },
  {
    number: "06",
    label: "Integrations",
    title: "Pipe in the rest of your team's work.",
    intro:
      "Plug GPR into the tools your team already uses so commits, tickets, and status changes feed scoring and the knowledge base.",
    items: [
      {
        title: "GitHub — connect a repo",
        detail:
          "On the GitHub source page, add owner/repo and (for private repos) a personal access token. Click Sync now to backfill the last 30 days of commits and PRs.",
      },
      {
        title: "GitHub — map usernames",
        detail:
          "For each project member, set their GitHub login on the Members tab. Commits attribute by login first, then fall back to the commit author's email or name so historical commits without a resolved login still get attributed.",
      },
      {
        title: "GitHub — syncing",
        detail:
          "Sync now pulls fresh commits and PRs and updates contribution scores. Failures surface as a banner on the GitHub page so silent breakage doesn't happen.",
      },
      {
        title: "Jira — connect a board",
        detail:
          "Provide a Jira base URL, account email, API token, and project key. GPR pulls the board's issues, statuses, assignees, and due dates.",
      },
      {
        title: "Jira — attribution",
        detail:
          "Map each member's Jira accountId on the Members tab. Tickets they close, ship overdue, or leave stale all feed into scoring and into the KB as Jira tasks Ask GPR can answer questions about.",
      },
    ],
  },
  {
    number: "07",
    label: "Leaderboard & scores",
    title: "Honest numbers, every meeting.",
    intro:
      "The leaderboard and project health score are computed from real activity — never edited by hand.",
    items: [
      {
        title: "Contribution scores",
        detail:
          "Per-member scores are recomputed from every match report and every contribution event (commits, PRs, Jira closures, MVP / yellow / red cards). The leaderboard averages a member's recent scores so a single quiet meeting doesn't tank them, and a single carry doesn't crown them.",
      },
      {
        title: "Project health score",
        detail:
          "A live 0–100 score from baseline 100 with deductions for inactive members, recent red and yellow cards, overdue commitments, the project going dark, and ghost members. MVP last meeting adds a small bonus.",
      },
      {
        title: "Health breakdown",
        detail:
          "Open the breakdown popover on the overview to see exactly which deductions and bonuses produced the current score, and the trend chip shows the delta since the last meeting's snapshot.",
      },
    ],
  },
  {
    number: "08",
    label: "Progress report",
    title: "One document, every angle.",
    intro:
      "Generate an end-to-end project progress report at any time. Pulls together health, team performance, meetings, commitments, and key decisions.",
    items: [
      {
        title: "How to generate",
        detail:
          "Open the Progress Report tab from a project (or the Quick Actions on the overview). The report renders live from current data — no scheduling, no drafts.",
      },
      {
        title: "Print",
        detail:
          "Click Print at the top. The print stylesheet hides the sidebar and the Ask GPR launcher and outputs a clean, B/W document with red section accents.",
      },
      {
        title: "Download as PDF",
        detail:
          "Click Download PDF. The PDF is generated client-side via @react-pdf/renderer and downloads as <project-slug>-progress-report-<date>.pdf. Page numbers, GPR brand, and the Generated by GPR footer included.",
      },
    ],
  },
];

export default async function DocsPage() {
  return (
    <PublicLayout>
      <main className="flex flex-1 flex-col">
      <section
        className="wrap"
        style={{ paddingTop: 80, paddingBottom: 40 }}
      >
        <div className="label fade-up" style={{ marginBottom: 24 }}>
          Docs
        </div>
        <h1
          className="display fade-up"
          style={{
            fontSize: "clamp(56px, 8vw, 112px)",
            margin: 0,
            fontWeight: 500,
          }}
        >
          How GPR works.
        </h1>
        <p
          className="body-lg fade-up"
          style={{
            margin: "32px 0 0",
            maxWidth: 560,
            animationDelay: "80ms",
          }}
        >
          Everything you need to take a project from sign-up to a printable
          progress report. Read top-to-bottom, or jump to the section you
          need.
        </p>
      </section>

      <hr className="hr" style={{ margin: "60px 0 0" }} />

      {sections.map((section) => (
        <section
          key={section.number}
          id={section.number}
          className="wrap"
          style={{ padding: "80px 40px" }}
        >
          {/* Section header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 80,
              marginBottom: 64,
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    background: "transparent",
                    color: "var(--mute)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    border: "1px solid var(--line)",
                    borderRadius: 3,
                  }}
                >
                  {section.number} · {section.label}
                </span>
              </div>
              <div
                className="display"
                style={{
                  fontSize: "clamp(36px, 4.4vw, 56px)",
                  fontWeight: 500,
                  lineHeight: 0.98,
                  letterSpacing: "-0.03em",
                }}
              >
                {section.title}
              </div>
            </div>

            <div style={{ paddingTop: 8 }}>
              <p
                className="body"
                style={{ margin: 0, color: "var(--mute)", maxWidth: 540 }}
              >
                {section.intro}
              </p>
            </div>
          </div>

          {/* Item list */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "0 80px",
            }}
          >
            <div
              className="label"
              style={{
                paddingTop: 24,
                borderTop: "1px solid var(--line)",
              }}
            >
              In this section
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              {section.items.map((item, i) => (
                <div
                  key={item.title}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr",
                    gap: 32,
                    padding: "22px 0",
                    borderBottom:
                      i < section.items.length - 1
                        ? "1px solid var(--line-2)"
                        : "none",
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      paddingTop: 1,
                    }}
                  >
                    {item.title}
                  </div>
                  <p
                    className="body"
                    style={{
                      margin: 0,
                      color: "var(--mute)",
                      fontSize: 14,
                    }}
                  >
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      </main>
    </PublicLayout>
  );
}
