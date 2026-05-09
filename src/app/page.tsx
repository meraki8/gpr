import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/wordmark";
import { RefCard } from "@/components/ref-card";

export default async function HomePage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;
  const cta = isSignedIn ? "Open dashboard →" : "Open the demo →";
  const ctaHref = isSignedIn ? "/dashboard" : "/sign-up";

  return (
    <main className="flex flex-1 flex-col">
      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 40px" }}
      >
        <Wordmark />
        <nav style={{ display: "flex", gap: 28, fontSize: 14 }}>
          <Link href="#how" className="lk-mute">
            How it works
          </Link>
          <Link href="/changelog" className="lk-mute">
            Changelog
          </Link>
          <Link href="/sign-in" className="lk-mute">
            Sign in
          </Link>
        </nav>
      </header>

      <section
        className="wrap"
        style={{ paddingTop: 120, paddingBottom: 140 }}
      >
        <div className="label fade-up" style={{ marginBottom: 32 }}>
          An accountability layer for group projects
        </div>
        <h1
          className="display fade-up"
          style={{
            fontSize: "clamp(72px, 12vw, 180px)",
            margin: 0,
            fontWeight: 500,
          }}
        >
          Every project
          <br />
          needs a <span className="red-ink" style={{ fontWeight: 500 }}>ref</span>.
        </h1>
        <div
          className="fade-up"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            marginTop: 80,
            animationDelay: "100ms",
          }}
        >
          <p className="body-lg" style={{ margin: 0, maxWidth: 460 }}>
            GPR reads your meeting transcripts, watches your tickets, and
            tells you who is delivering and who is not. No confrontation. No
            awkward conversations. Just evidence.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 18,
            }}
          >
            <Link
              href={ctaHref}
              className="pill pill-red"
              style={{ padding: "14px 24px", fontSize: 15 }}
            >
              {cta}
            </Link>
            <span className="mute-ink" style={{ fontSize: 13 }}>
              No setup. The ref starts watching after your first stand-up.
            </span>
          </div>
        </div>
      </section>

      <hr className="hr" />

      <section
        id="how"
        className="wrap"
        style={{ padding: "120px 40px" }}
      >
        <div className="label" style={{ marginBottom: 56 }}>
          How it works
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 1fr 1fr",
            gap: 48,
          }}
        >
          <div />
          <Step
            n="01"
            t="Set up the project"
            b="Create a group, add a project brief, invite the team. Members get a single email to accept."
          />
          <Step
            n="02"
            t="Feed the meetings"
            b="After each stand-up, paste a transcript. The ref reads it and files a match report in seconds."
          />
          <Step
            n="03"
            t="Read the verdict"
            b="Per-member scores, commitments quoted verbatim, and cards drafted for whoever needs them."
          />
        </div>
      </section>

      <hr className="hr" />

      <section className="wrap" style={{ padding: "120px 40px" }}>
        <h2
          className="display h-l"
          style={{ margin: 0, marginBottom: 80, maxWidth: 720 }}
        >
          Three calls. <span className="mute-ink">One rulebook.</span>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 56,
          }}
        >
          <CardSpec
            kind="y"
            title="Yellow card"
            sub="Falling behind"
            body="Vague commitments. Tickets going stale. The ref books you, and the team sees it."
            rotate={-3}
          />
          <CardSpec
            kind="r"
            title="Red card"
            sub="No contact"
            body="No-shows, missed deadlines without notice, deliverables ghosted for days."
            rotate={4}
          />
          <CardSpec
            kind="mvp"
            title="MVP"
            sub="Top contributor"
            body="Quietly carrying the project. The ref keeps receipts so you don't have to defend yourself in retro."
            rotate={-1}
          />
        </div>
      </section>

      <hr className="hr" />

      <section
        className="wrap"
        style={{ padding: "160px 40px", textAlign: "left" }}
      >
        <p
          className="display"
          style={{
            fontSize: "clamp(36px, 5vw, 64px)",
            margin: 0,
            fontWeight: 400,
            lineHeight: 1.1,
            maxWidth: 980,
          }}
        >
          The work was not evenly shared.{" "}
          <span className="red-ink">Two members carried the load.</span> One
          has not delivered in eleven days.
        </p>
        <div className="label" style={{ marginTop: 32 }}>
          Sample digest, redacted
        </div>
      </section>

      <hr className="hr" />

      <section className="wrap" style={{ padding: "120px 40px" }}>
        <h2
          className="display"
          style={{
            fontSize: "clamp(56px, 8vw, 112px)",
            margin: 0,
            fontWeight: 500,
            lineHeight: 0.95,
          }}
        >
          Stop hoping it
          <br />
          gets <span className="red-ink">fair</span>.
        </h2>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <Link
            href={ctaHref}
            className="pill pill-red"
            style={{ padding: "14px 24px", fontSize: 15 }}
          >
            {cta}
          </Link>
          {!isSignedIn && (
            <Link
              href="/sign-in"
              className="pill pill-ghost"
              style={{ padding: "13px 22px", fontSize: 15 }}
            >
              Sign in
            </Link>
          )}
        </div>
      </section>

      <footer
        style={{
          padding: 40,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "var(--mute)",
          fontSize: 13,
        }}
      >
        <Wordmark small />
        <span>© {new Date().getFullYear()} GPR · Group Project Referee</span>
      </footer>
    </main>
  );
}

function Step({ n, t, b }: { n: string; t: string; b: string }) {
  return (
    <div>
      <div
        className="num mute-ink"
        style={{ fontSize: 13, marginBottom: 14 }}
      >
        {n}
      </div>
      <div className="h-s" style={{ marginBottom: 10 }}>
        {t}
      </div>
      <p className="body" style={{ margin: 0, color: "var(--mute)" }}>
        {b}
      </p>
    </div>
  );
}

function CardSpec({
  kind,
  title,
  sub,
  body,
  rotate,
}: {
  kind: "y" | "r" | "mvp";
  title: string;
  sub: string;
  body: string;
  rotate: number;
}) {
  return (
    <div>
      <div
        style={{
          marginBottom: 28,
          height: 120,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <RefCard kind={kind} size={120} rotate={rotate} />
      </div>
      <div className="h-s" style={{ marginBottom: 4 }}>
        {title}
      </div>
      <div
        className="label"
        style={{
          color: kind === "r" ? "var(--red)" : "var(--mute)",
          marginBottom: 14,
        }}
      >
        {sub}
      </div>
      <p className="body" style={{ margin: 0, color: "var(--mute)" }}>
        {body}
      </p>
    </div>
  );
}
