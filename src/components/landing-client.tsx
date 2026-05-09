"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Wordmark } from "@/components/wordmark";
import { RefCard, type RefCardKind } from "@/components/ref-card";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Next.js client components still server-render once for hydration,
// and useLayoutEffect logs a warning during that pass. Falling back
// to useEffect on the server keeps the runtime quiet while still
// running synchronously before paint on the client — which is what
// we need so GSAP can apply initial states before the user sees the
// elements at full visibility.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = {
  isSignedIn: boolean;
};

export function LandingClient({ isSignedIn }: Props) {
  const root = useRef<HTMLElement | null>(null);
  const cta = isSignedIn ? "Open dashboard →" : "Start for free →";
  const ctaHref = isSignedIn ? "/dashboard" : "/sign-up";

  useIsoLayoutEffect(() => {
    if (!root.current) return;
    if (typeof window !== "undefined") {
      // Diagnostic — visible in devtools so we can confirm GSAP and
      // the ScrollTrigger plugin are actually loaded in production.
      console.log(
        "[GPR] gsap",
        gsap.version,
        "scrollTrigger",
        !!ScrollTrigger,
      );
    }
    const ctx = gsap.context(() => {
      // ===== HERO =====
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      gsap.set(".hero-eyebrow", { y: 12, opacity: 0 });
      gsap.set(".hero-word", { y: 28, opacity: 0 });
      gsap.set(".hero-sub", { y: 18, opacity: 0 });
      gsap.set(".hero-cta", { scale: 0.8, opacity: 0 });

      heroTl
        .to(".hero-eyebrow", { y: 0, opacity: 1, duration: 0.55 })
        .to(
          ".hero-word",
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.1,
            ease: "power3.out",
          },
          "-=0.2",
        )
        .to(".hero-sub", { y: 0, opacity: 1, duration: 0.7 }, "+=0.05")
        .to(
          ".hero-cta",
          {
            scale: 1,
            opacity: 1,
            duration: 0.9,
            stagger: 0.1,
            ease: "elastic.out(1, 0.55)",
          },
          "-=0.3",
        );

      // Floating shapes — random drift + slow rotation, looped.
      const shapes = gsap.utils.toArray<HTMLElement>(".float-shape");
      shapes.forEach((shape) => {
        const dx = gsap.utils.random(-22, 22);
        const dy = gsap.utils.random(-26, 26);
        const dr = gsap.utils.random(-12, 12);
        const dur = gsap.utils.random(5, 9);
        gsap.to(shape, {
          x: `+=${dx}`,
          y: `+=${dy}`,
          rotation: `+=${dr}`,
          duration: dur,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });

      // Mouse parallax — applied to the wrapper so it composes with
      // the inner floating tween without fighting it.
      const heroEl = root.current?.querySelector<HTMLElement>(".hero");
      const onMove = (e: MouseEvent) => {
        if (!heroEl) return;
        const r = heroEl.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width - 0.5;
        const cy = (e.clientY - r.top) / r.height - 0.5;
        gsap.utils
          .toArray<HTMLElement>(".float-wrap")
          .forEach((wrap, i) => {
            const depth = 6 + i * 4;
            gsap.to(wrap, {
              x: cx * depth,
              y: cy * depth,
              duration: 0.8,
              ease: "power2.out",
            });
          });
      };
      const onLeave = () => {
        gsap.to(".float-wrap", {
          x: 0,
          y: 0,
          duration: 1,
          ease: "power2.out",
        });
      };
      heroEl?.addEventListener("mousemove", onMove);
      heroEl?.addEventListener("mouseleave", onLeave);

      // ===== PROBLEM =====
      gsap.from(".problem-card", {
        y: 60,
        opacity: 0,
        rotation: () => gsap.utils.random(-2, 2),
        duration: 0.85,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: ".problem", start: "top 78%" },
      });

      // ===== HOW IT WORKS =====
      gsap.utils.toArray<HTMLElement>(".step-block").forEach((stepEl, i) => {
        gsap.from(stepEl.querySelectorAll<HTMLElement>(".step-content > *"), {
          y: 26,
          opacity: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          delay: i * 0.05,
          scrollTrigger: { trigger: stepEl, start: "top 82%" },
        });
        const numEl = stepEl.querySelector<HTMLElement>(".step-num");
        if (numEl) {
          const target = Number(numEl.dataset.target ?? "0");
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            onUpdate: () => {
              numEl.textContent = String(Math.round(obj.v)).padStart(
                2,
                "0",
              );
            },
            scrollTrigger: { trigger: stepEl, start: "top 82%" },
          });
        }
      });

      // ===== MATCH REPORT MOCKUP =====
      gsap.from(".match-frame", {
        x: 80,
        opacity: 0,
        duration: 0.95,
        ease: "power3.out",
        scrollTrigger: { trigger: ".match-frame", start: "top 78%" },
      });
      gsap.from(".match-row", {
        rotateY: 90,
        opacity: 0,
        transformOrigin: "0% 50%",
        duration: 0.85,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: { trigger: ".match-frame", start: "top 70%" },
      });
      gsap.from(".match-name", {
        x: -24,
        opacity: 0,
        duration: 0.6,
        stagger: 0.18,
        ease: "power2.out",
        scrollTrigger: { trigger: ".match-frame", start: "top 70%" },
      });
      gsap.utils.toArray<HTMLElement>(".match-score").forEach((el) => {
        const target = Number(el.dataset.target ?? "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v));
          },
          scrollTrigger: { trigger: ".match-frame", start: "top 65%" },
        });
      });

      // ===== FEATURES =====
      gsap.from(".feature-card", {
        y: 50,
        opacity: 0,
        duration: 0.75,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".features", start: "top 80%" },
      });
      // Subtle continuous float per card with varied speed.
      gsap.utils.toArray<HTMLElement>(".feature-card").forEach((el, i) => {
        gsap.to(el, {
          y: "-=3",
          duration: 2 + (i % 4) * 0.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: i * 0.15,
        });
      });

      // ===== FINAL CTA =====
      gsap.from(".final-word", {
        y: 32,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".final-cta", start: "top 78%" },
      });
      gsap.from(".final-sub", {
        y: 16,
        opacity: 0,
        duration: 0.6,
        delay: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: ".final-cta", start: "top 78%" },
      });
      // Pulsing red glow on final CTA button.
      gsap.to(".final-button", {
        boxShadow: "0 0 32px rgba(225, 6, 0, 0.55)",
        duration: 1.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // Initial refresh in case anything was sized incorrectly while
      // animations were being created.
      ScrollTrigger.refresh();

      return () => {
        heroEl?.removeEventListener("mousemove", onMove);
        heroEl?.removeEventListener("mouseleave", onLeave);
      };
    }, root);

    // Fonts (Bricolage) and any deferred images can shift layout
    // after first paint. Refresh ScrollTrigger when web fonts are
    // ready and when the window finishes loading so triggers compute
    // against the final rendered layout instead of a pre-font one.
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      ScrollTrigger.refresh();
    };
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(refresh).catch(() => {});
    }
    if (typeof window !== "undefined") {
      window.addEventListener("load", refresh);
    }
    // One more on the next frame for good measure (handles cases
    // where layout settles a frame after mount in production).
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(refresh);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (typeof window !== "undefined") {
        window.removeEventListener("load", refresh);
      }
      ctx.revert();
    };
  }, []);

  const heroWords = [
    "The",
    "ref",
    "your",
    "group",
    "project",
    "never",
    "had.",
  ];
  const finalWords = ["Stop", "being", "the", "one", "who", "does", "everything."];

  return (
    <main ref={root} className="flex flex-1 flex-col">
      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 40px", position: "relative", zIndex: 5 }}
      >
        <Wordmark />
        <nav style={{ display: "flex", gap: 28, fontSize: 14 }}>
          <Link href="#how" className="lk-mute">
            How it works
          </Link>
          <Link href="/sign-in" className="lk-mute">
            Sign in
          </Link>
        </nav>
      </header>

      {/* ============== HERO ============== */}
      <section
        className="hero wrap"
        style={{
          paddingTop: 120,
          paddingBottom: 140,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <FloatingShapes />

        <div
          className="hero-eyebrow label"
          style={{ marginBottom: 32, position: "relative", zIndex: 2 }}
        >
          An accountability layer for group projects
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(64px, 11.5vw, 168px)",
            margin: 0,
            fontWeight: 500,
            lineHeight: 0.96,
            position: "relative",
            zIndex: 2,
          }}
        >
          {heroWords.map((w, i) => (
            <span
              key={i}
              className="hero-word"
              style={{
                display: "inline-block",
                marginRight: "0.22em",
                color: w === "ref" ? "var(--red)" : "var(--ink)",
                fontWeight: 500,
              }}
            >
              {w}
            </span>
          ))}
        </h1>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            marginTop: 80,
            position: "relative",
            zIndex: 2,
          }}
        >
          <p
            className="body-lg hero-sub"
            style={{ margin: 0, maxWidth: 460 }}
          >
            GPR reads your meeting transcripts, tracks every commitment,
            and scores your team automatically. No bias. No politics. No
            excuses.
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
              className="hero-cta pill pill-red"
              style={{ padding: "14px 24px", fontSize: 15 }}
            >
              {cta}
            </Link>
            <Link
              href="#how"
              className="hero-cta pill pill-ghost"
              style={{ padding: "13px 22px", fontSize: 15 }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <hr className="hr" />

      {/* ============== PROBLEM ============== */}
      <section
        className="problem wrap"
        style={{ padding: "120px 40px" }}
      >
        <div className="label" style={{ marginBottom: 56 }}>
          The problem
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 32,
          }}
        >
          <ProblemCard
            kicker="The ghost"
            headline="You wrote the report. They put their name on it."
          />
          <ProblemCard
            kicker="The procrastinator"
            headline="The meeting had action items. Nobody did them."
          />
          <ProblemCard
            kicker="The scapegoat"
            headline="The deadline passed. Someone blamed the tools."
          />
        </div>
      </section>

      <hr className="hr" />

      {/* ============== HOW IT WORKS ============== */}
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
            n={1}
            t="Drop your transcript"
            b="Paste or upload any meeting notes. GPR reads every word."
          />
          <Step
            n={2}
            t="The ref analyses"
            b="AI extracts who committed to what, who delivered, and who went quiet."
          />
          <Step
            n={3}
            t="Cards are issued"
            b="Yellow. Red. MVP. Automatically. No appeals. The ref's decision is final."
          />
        </div>
      </section>

      <hr className="hr" />

      {/* ============== THREE CALLS — kept from existing layout ============== */}
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

      {/* ============== MATCH REPORT MOCKUP ============== */}
      <section className="wrap" style={{ padding: "120px 40px" }}>
        <div className="label" style={{ marginBottom: 24 }}>
          A real match report
        </div>
        <h2
          className="display"
          style={{
            margin: 0,
            marginBottom: 64,
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 500,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Receipts. <span className="red-ink">With timestamps.</span>
        </h2>

        <div
          className="match-frame"
          style={{
            position: "relative",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "var(--paper)",
            padding: 32,
            maxWidth: 880,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "var(--red)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--line)",
              paddingBottom: 20,
              marginBottom: 8,
            }}
          >
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Sprint 04 · Meeting recap
              </div>
              <div
                className="display"
                style={{ fontSize: 26, fontWeight: 500 }}
              >
                Project Falcon
              </div>
            </div>
            <div
              className="num"
              style={{
                fontSize: 13,
                letterSpacing: "0.22em",
                color: "var(--red)",
                border: "1.5px solid var(--red)",
                padding: "6px 12px",
                borderRadius: 4,
                transform: "rotate(-3deg)",
                fontWeight: 500,
              }}
            >
              FINAL
            </div>
          </div>

          <MatchRow
            rank={1}
            name="Maya Chen"
            role="frontend"
            score={94}
            kind="mvp"
          />
          <MatchRow
            rank={2}
            name="Diego Park"
            role="backend"
            score={71}
            kind={null}
          />
          <MatchRow
            rank={3}
            name="Jordan R."
            role="design"
            score={58}
            kind="y"
          />
          <MatchRow
            rank={4}
            name="Sam K."
            role="PM"
            score={22}
            kind="r"
            isLast
          />
        </div>
      </section>

      <hr className="hr" />

      {/* ============== SAMPLE DIGEST — kept from existing layout ============== */}
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
          <span className="red-ink">Two members carried the load.</span>{" "}
          One has not delivered in eleven days.
        </p>
        <div className="label" style={{ marginTop: 32 }}>
          Sample digest, redacted
        </div>
      </section>

      <hr className="hr" />

      {/* ============== FEATURES GRID ============== */}
      <section
        className="features wrap"
        style={{ padding: "120px 40px" }}
      >
        <div className="label" style={{ marginBottom: 24 }}>
          Capabilities
        </div>
        <h2
          className="display"
          style={{
            margin: 0,
            marginBottom: 64,
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 500,
            lineHeight: 1.05,
          }}
        >
          Everything a good ref needs.
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
          }}
        >
          <Feature
            title="Meeting analysis"
            copy="Reads transcripts so you do not have to."
          />
          <Feature
            title="Knowledge base"
            copy="Remembers everything so nobody can say they forgot."
          />
          <Feature
            title="Leaderboard"
            copy="Who is carrying the squad. Updated after every meeting."
          />
          <Feature
            title="Ask GPR"
            copy="Ask the project anything. It only knows what your team has done."
          />
          <Feature
            title="GitHub integration"
            copy="Commits do not lie. Neither does GPR."
          />
          <Feature
            title="Multi-source"
            copy="Transcripts, GitHub, Jira. Every angle covered."
          />
        </div>
      </section>

      <hr className="hr" />

      {/* ============== FINAL CTA ============== */}
      <section
        className="final-cta wrap"
        style={{ padding: "120px 40px" }}
      >
        <h2
          className="display"
          style={{
            fontSize: "clamp(56px, 8vw, 112px)",
            margin: 0,
            fontWeight: 500,
            lineHeight: 0.96,
            maxWidth: 1080,
          }}
        >
          {finalWords.map((w, i) => (
            <span
              key={i}
              className="final-word"
              style={{
                display: "inline-block",
                marginRight: "0.22em",
                fontWeight: 500,
              }}
            >
              {w}
            </span>
          ))}
        </h2>
        <p
          className="final-sub body-lg"
          style={{
            margin: "32px 0 40px",
            color: "var(--mute)",
            maxWidth: 560,
          }}
        >
          Let GPR keep the receipts.
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={ctaHref}
            className="final-button pill pill-red"
            style={{
              padding: "16px 28px",
              fontSize: 15,
              borderRadius: 999,
            }}
          >
            {isSignedIn ? "Open dashboard →" : "Start for free →"}
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

function Step({ n, t, b }: { n: number; t: string; b: string }) {
  return (
    <div className="step-block">
      <div
        className="step-num num mute-ink"
        data-target={n}
        style={{ fontSize: 13, marginBottom: 14 }}
      >
        00
      </div>
      <div className="step-content">
        <div className="h-s" style={{ marginBottom: 10 }}>
          {t}
        </div>
        <p className="body" style={{ margin: 0, color: "var(--mute)" }}>
          {b}
        </p>
      </div>
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
  kind: RefCardKind;
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

function ProblemCard({
  kicker,
  headline,
}: {
  kicker: string;
  headline: string;
}) {
  return (
    <article
      className="problem-card"
      style={{
        padding: 28,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--paper)",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 18px 40px -18px rgba(225, 6, 0, 0.22)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <RedX />
      <div
        className="label"
        style={{ color: "var(--red)", marginTop: 16, marginBottom: 12 }}
      >
        {kicker}
      </div>
      <div
        className="h-s"
        style={{ fontSize: 22, lineHeight: 1.25 }}
      >
        {headline}
      </div>
    </article>
  );
}

function RedX() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden>
      <line
        x1="6"
        y1="6"
        x2="34"
        y2="34"
        stroke="var(--red)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="34"
        y1="6"
        x2="6"
        y2="34"
        stroke="var(--red)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Feature({ title, copy }: { title: string; copy: string }) {
  return (
    <article
      className="feature-card"
      style={{
        padding: "26px 24px",
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--paper)",
        transition: "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        cursor: "default",
        willChange: "transform",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.borderColor = "var(--red)";
        e.currentTarget.style.boxShadow =
          "0 0 0 1px var(--red), 0 20px 40px -20px rgba(225, 6, 0, 0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <div className="h-s" style={{ marginBottom: 8, fontSize: 18 }}>
        {title}
      </div>
      <p
        className="body"
        style={{ margin: 0, color: "var(--mute)", fontSize: 14 }}
      >
        {copy}
      </p>
    </article>
  );
}

function MatchRow({
  rank,
  name,
  role,
  score,
  kind,
  isLast,
}: {
  rank: number;
  name: string;
  role: string;
  score: number;
  kind: RefCardKind | null;
  isLast?: boolean;
}) {
  return (
    <div
      className="match-row"
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) 44px 90px",
        gap: 18,
        alignItems: "center",
        padding: "18px 0",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <span
        className="num display"
        style={{
          fontSize: 22,
          color: "var(--mute-2, var(--mute))",
          fontWeight: 500,
        }}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <div className="match-name" style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          className="mute-ink"
          style={{ fontSize: 12, textTransform: "lowercase" }}
        >
          {role}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 22,
        }}
      >
        {kind && <RefCard kind={kind} size={20} />}
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          className="match-score num display"
          data-target={score}
          style={{
            fontSize: 44,
            lineHeight: 1,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          0
        </span>
      </div>
    </div>
  );
}

function FloatingShapes() {
  // 6 subtle drifting accents behind the hero. Each lives inside a
  // wrapper so mouse-parallax can translate the wrapper while the
  // inner element keeps its own continuous floating tween.
  const shapes: Array<{
    top: string;
    left?: string;
    right?: string;
    rotate: number;
    el: React.ReactNode;
    opacity: number;
  }> = [
    {
      top: "8%",
      left: "4%",
      rotate: -14,
      opacity: 0.18,
      el: <RefCard kind="y" size={54} />,
    },
    {
      top: "18%",
      right: "8%",
      rotate: 12,
      opacity: 0.16,
      el: <RedSquare size={42} />,
    },
    {
      top: "55%",
      left: "10%",
      rotate: 0,
      opacity: 0.14,
      el: <RedSquare size={28} />,
    },
    {
      top: "62%",
      right: "14%",
      rotate: 18,
      opacity: 0.2,
      el: <RefCard kind="mvp" size={48} />,
    },
    {
      top: "82%",
      left: "20%",
      rotate: -6,
      opacity: 0.16,
      el: <RefCard kind="r" size={42} />,
    },
    {
      top: "78%",
      right: "30%",
      rotate: 9,
      opacity: 0.14,
      el: <RefCard kind="y" size={36} />,
    },
  ];
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {shapes.map((s, i) => (
        <span
          key={i}
          className="float-wrap"
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            right: s.right,
            opacity: s.opacity,
            willChange: "transform",
          }}
        >
          <span
            className="float-shape"
            style={{
              display: "inline-block",
              transform: `rotate(${s.rotate}deg)`,
              willChange: "transform",
            }}
          >
            {s.el}
          </span>
        </span>
      ))}
    </div>
  );
}

function RedSquare({ size }: { size: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        background: "var(--red)",
        borderRadius: 4,
      }}
    />
  );
}
