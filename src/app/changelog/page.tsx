import { PublicFooter } from "@/components/public-footer";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Changelog — GPR",
  description: "What's new in GPR.",
};

const releases: Release[] = [
  {
    version: "1.0",
    label: "GPR 1.0",
    date: "May 2026",
    type: "major",
    headline:
      "Built in one night at SaaSathon 2026, University of Canterbury.",
    body: "The ref is in the room. Core accountability loop is live — from transcript to verdict in under 20 seconds.",
    capabilities: [
      {
        title: "Authentication",
        detail:
          "Sign up and sign in via Clerk. Email-based, no passwords to manage.",
      },
      {
        title: "Groups and projects",
        detail:
          "Create a group, add projects inside it. Each project carries its own brief, deadline, and member roster.",
      },
      {
        title: "Team invitations",
        detail:
          "Invite teammates by email. They get a 7-day accept link and land directly into the project.",
      },
      {
        title: "Transcript analysis",
        detail:
          "Paste any meeting transcript. Claude reads who said what, extracts commitments, and scores every member.",
      },
      {
        title: "Multi-source transcript detection",
        detail:
          "GPR auto-detects whether your transcript came from Zoom, Discord, Slack, WhatsApp, or email — and adjusts its analysis accordingly.",
      },
      {
        title: "Match reports",
        detail:
          "Every transcript generates a full Match Report — per-member contribution scores, commitments quoted verbatim, and drafted cards.",
      },
      {
        title: "Cards system",
        detail:
          "Yellow card for falling behind. Red card for ghosting. MVP for the top contributor. Owner reviews and publishes.",
      },
      {
        title: "Leaderboard",
        detail:
          "Contribution scores averaged across all published reports. Visible to every team member.",
      },
      {
        title: "Knowledge Base",
        detail:
          "Every transcript automatically extracts key decisions, commitments, and context into a growing project knowledge base. Searchable, filterable, and cited by source.",
      },
      {
        title: "Ask GPR",
        detail:
          "A project-aware AI chatbot scoped entirely to your project KB. Ask what was decided last meeting, who owns a task, or what the team has committed to. It only knows what your project knows.",
      },
      {
        title: "Session-persistent Ask GPR",
        detail:
          "Chat history persists for 7 days across sessions. Pick up where you left off without losing context.",
      },
      {
        title: "GitHub integration",
        detail:
          "Connect a public GitHub repo. Commits and PRs sync automatically and feed into contribution scoring.",
      },
      {
        title: "Jira Integration",
        detail:
          "Connect your Jira board. Tickets sync automatically and feed into contribution scores. Who closed what and when — all tracked.",
      },
      {
        title: "Notification Bell",
        detail:
          "Real-time notifications for project invites, cards received, and new match reports. Accept invites directly from the bell without leaving the app.",
      },
      {
        title: "Project Health Score",
        detail:
          "A live health score computed from card history, inactive members, overdue commitments, and meeting frequency. Breaks down exactly why the score moved up or down.",
      },
      {
        title: "Progress Report",
        detail:
          "Generate a full project progress report at any time. Printable and downloadable as PDF. Covers team performance, meeting history, open commitments, and key decisions.",
      },
    ],
  },
];

const roadmap: RoadmapItem[] = [
  {
    title: "Contract generation and digital signing",
    detail:
      "AI-generated group contracts. Every member signs before the project begins. Timestamped and saved as PDF.",
  },
  {
    title: "Weekly AI digest",
    detail:
      "Every Monday, GPR analyses all project activity and sends a summary to the team — who delivered, who is stalling, risk level, recommended actions.",
  },
  {
    title: "Ghost detector",
    detail:
      "Checks for member inactivity every 24 hours and escalates automatically. No one disappears quietly.",
  },
  {
    title: "In-app meeting transcriber",
    detail:
      "Real-time transcript capture during a meeting. No copy-paste — GPR joins the call and files the report when it ends.",
  },
  {
    title: "Google Drive integration",
    detail:
      "Connect a Drive folder as a project source. Documents, briefs, and deliverables feed the AI for richer analysis.",
  },
  {
    title: "WhatsApp · Slack · Discord",
    detail:
      "Read group communication from the platforms your team already uses. Every message, task update, and promise becomes evidence.",
  },
  {
    title: "Native mobile app",
    detail: "iOS and Android. GPR in your pocket. Get carded anywhere.",
  },
];

type Release = {
  version: string;
  label: string;
  date: string;
  type: "major" | "minor";
  headline: string;
  body: string;
  capabilities: { title: string; detail: string }[];
};

type RoadmapItem = {
  title: string;
  detail: string;
};

export default async function ChangelogPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PublicNav
        links={[
          { href: "/", label: "Home" },
          { href: "/#how", label: "How it works" },
          { href: "/docs", label: "Docs" },
        ]}
      />

      <section className="wrap" style={{ paddingTop: 100, paddingBottom: 40 }}>
        <div className="label fade-up" style={{ marginBottom: 24 }}>
          Changelog
        </div>
        <h1
          className="display fade-up"
          style={{
            fontSize: "clamp(56px, 8vw, 112px)",
            margin: 0,
            fontWeight: 500,
          }}
        >
          What changed.
        </h1>
        <p
          className="body-lg fade-up"
          style={{
            margin: "32px 0 0",
            maxWidth: 560,
            animationDelay: "80ms",
          }}
        >
          Every version of GPR. What shipped, what it does, and what is coming next.
        </p>
      </section>

      <hr className="hr" style={{ margin: "60px 0 0" }} />

      {releases.map((release) => (
        <section
          key={release.version}
          className="wrap"
          style={{ padding: "80px 40px" }}
        >
          {/* Version header */}
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
                    background: "var(--red)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderRadius: 3,
                  }}
                >
                  {release.type === "major" ? "Major release" : "Update"}
                </span>
              </div>
              <div
                className="display"
                style={{
                  fontSize: "clamp(40px, 5vw, 64px)",
                  fontWeight: 500,
                  lineHeight: 0.95,
                  letterSpacing: "-0.03em",
                }}
              >
                {release.label}
              </div>
              <div
                className="num mute-ink"
                style={{ fontSize: 13, marginTop: 12 }}
              >
                {release.date}
              </div>
            </div>

            <div style={{ paddingTop: 8 }}>
              <div
                className="h-s"
                style={{ marginBottom: 12 }}
              >
                {release.headline}
              </div>
              <p
                className="body"
                style={{ margin: 0, color: "var(--mute)", maxWidth: 540 }}
              >
                {release.body}
              </p>
            </div>
          </div>

          {/* Capabilities list */}
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
              Capabilities
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              {release.capabilities.map((cap, i) => (
                <div
                  key={cap.title}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr",
                    gap: 32,
                    padding: "22px 0",
                    borderBottom:
                      i < release.capabilities.length - 1
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
                    {cap.title}
                  </div>
                  <p
                    className="body"
                    style={{ margin: 0, color: "var(--mute)", fontSize: 14 }}
                  >
                    {cap.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <hr className="hr" />

      {/* Roadmap */}
      <section className="wrap" style={{ padding: "80px 40px 120px" }}>
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
                Coming up
              </span>
            </div>
            <div
              className="display"
              style={{
                fontSize: "clamp(40px, 5vw, 64px)",
                fontWeight: 500,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
              }}
            >
              Roadmap.
            </div>
          </div>

          <div style={{ paddingTop: 8 }}>
            <div className="h-s" style={{ marginBottom: 12 }}>
              What comes after 1.0.
            </div>
            <p
              className="body"
              style={{ margin: 0, color: "var(--mute)", maxWidth: 540 }}
            >
              The ref is getting smarter. These are the integrations and features
              in active development — the ones that close every remaining gap in
              how a project gets tracked.
            </p>
          </div>
        </div>

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
          />
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {roadmap.map((item, i) => (
              <div
                key={item.title}
                className="fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: 32,
                  padding: "22px 0",
                  borderBottom:
                    i < roadmap.length - 1
                      ? "1px solid var(--line-2)"
                      : "none",
                  animationDelay: `${i * 40}ms`,
                  opacity: 0.7,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    paddingTop: 1,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--line)",
                      border: "1px solid var(--mute-2)",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {item.title}
                  </span>
                </div>
                <p
                  className="body"
                  style={{ margin: 0, color: "var(--mute)", fontSize: 14 }}
                >
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
