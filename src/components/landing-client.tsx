"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Wordmark } from "@/components/wordmark";
import { RefCard, type RefCardKind } from "@/components/ref-card";
import { PublicFooter } from "@/components/public-footer";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// useLayoutEffect logs a warning during SSR. This shim falls back to
// useEffect on the server so the runtime stays quiet, while still
// running synchronously before paint on the client — necessary for
// GSAP to set initial states before users see un-animated elements.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Fictional broadcast names — never use real team-member names here.
const TICKER_ENTRIES: Array<{
  name: string;
  score: number;
  badge: string;
}> = [
  { name: "Jordan", score: 94, badge: "⚡" },
  { name: "Maya", score: 88, badge: "🏆" },
  { name: "Sam", score: 71, badge: "🟡" },
  { name: "Alex", score: 45, badge: "🔴" },
  { name: "Priya", score: 82, badge: "⚡" },
  { name: "Casey", score: 12, badge: "💀" },
  { name: "Riley", score: 67, badge: "🟡" },
  { name: "Morgan", score: 55, badge: "" },
];

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
      console.log(
        "[GPR] gsap",
        gsap.version,
        "scrollTrigger",
        !!ScrollTrigger,
      );
    }

    const ctx = gsap.context(() => {
      // ===== HERO LOAD TIMELINE =====
      gsap.set(".hero-eyebrow", { y: 12, opacity: 0 });
      gsap.set(".hero-word", { y: 32, opacity: 0 });
      gsap.set(".hero-line", { scaleX: 0 });
      gsap.set(".hero-sub", { y: 18, opacity: 0 });
      gsap.set(".hero-cta", { scale: 0.85, opacity: 0 });
      gsap.set(".hero-glow", { opacity: 0, scale: 0.85 });
      gsap.set(".hero-flip-card", { opacity: 0, x: 60, rotateY: 180 });

      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .to(".hero-glow", {
          opacity: 1,
          scale: 1,
          duration: 1.1,
          ease: "power2.out",
        })
        .to(
          ".hero-flip-card",
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            duration: 1.2,
            ease: "back.out(1.4)",
          },
          "-=0.9",
        )
        .to(".hero-eyebrow", { y: 0, opacity: 1, duration: 0.55 }, "-=1.0")
        .to(
          ".hero-word",
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.09,
            ease: "power3.out",
          },
          "-=0.3",
        )
        .to(
          ".hero-line",
          { scaleX: 1, duration: 1.0, ease: "power4.inOut" },
          "-=0.25",
        )
        .to(".hero-sub", { y: 0, opacity: 1, duration: 0.7 }, "-=0.6")
        .to(
          ".hero-cta",
          {
            scale: 1,
            opacity: 1,
            duration: 0.9,
            stagger: 0.1,
            ease: "elastic.out(1, 0.55)",
          },
          "-=0.5",
        );

      // Continuous subtle float on the hero referee card.
      gsap.to(".hero-flip-card", {
        y: "-=10",
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 1.6,
      });

      // Hero glow drifts so it never feels static.
      gsap.to(".hero-glow", {
        x: "+=40",
        y: "+=20",
        duration: 8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // Scoreboard background numbers count up forever.
      gsap.utils
        .toArray<HTMLElement>(".scoreboard-digit")
        .forEach((el, i) => {
          const obj = { v: 0 };
          gsap.to(obj, {
            v: 99,
            duration: 4 + (i % 3),
            ease: "none",
            repeat: -1,
            onUpdate: () => {
              el.textContent = String(Math.floor(obj.v)).padStart(2, "0");
            },
          });
        });

      // ===== PROBLEM SECTION — red X stamp =====
      gsap.from(".problem-card", {
        y: 50,
        opacity: 0,
        rotation: () => gsap.utils.random(-2, 2),
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: ".problem", start: "top 78%" },
      });
      // The stamp itself: scale from 2x with bounce, then a tiny shake.
      gsap.utils.toArray<HTMLElement>(".red-x-stamp").forEach((el, i) => {
        gsap.set(el, { scale: 2, rotate: -18, opacity: 0 });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: "top 85%" },
          delay: i * 0.18,
        });
        tl.to(el, {
          scale: 1,
          rotate: -10,
          opacity: 1,
          duration: 0.35,
          ease: "back.out(2.4)",
        }).to(el.parentElement, {
          x: 4,
          duration: 0.06,
          yoyo: true,
          repeat: 3,
          ease: "power1.inOut",
        });
      });

      // ===== HOW IT WORKS — split-flap step numbers =====
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
        if (!numEl) return;
        const target = Number(numEl.dataset.target ?? "0");
        // Split-flap: cycle digits with a vertical flip before settling.
        ScrollTrigger.create({
          trigger: stepEl,
          start: "top 82%",
          once: true,
          onEnter: () => animateSplitFlap(numEl, target),
        });
      });

      // ===== THREE CALLS — cards dealt from off-screen right =====
      gsap.utils.toArray<HTMLElement>(".deal-card").forEach((card, i) => {
        gsap.from(card, {
          x: 220 + i * 40,
          y: -30,
          rotation: 14 + i * 4,
          opacity: 0,
          duration: 0.9,
          ease: "back.out(1.5)",
          delay: i * 0.18,
          scrollTrigger: { trigger: ".three-calls", start: "top 80%" },
        });
        // Continuous float per dealt card.
        gsap.to(card, {
          y: "-=4",
          duration: 2.4 + (i % 3) * 0.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 1.4 + i * 0.2,
        });
      });

      // ===== MATCH REPORT MOCKUP =====
      gsap.from(".match-frame", {
        x: 120,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".match-frame", start: "top 78%" },
      });
      gsap.from(".match-row", {
        x: -30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".match-frame", start: "top 70%" },
      });
      gsap.utils.toArray<HTMLElement>(".match-score").forEach((el) => {
        const target = Number(el.dataset.target ?? "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.5,
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

      // ===== TESTIMONIALS =====
      gsap.from(".testimonial", {
        y: 40,
        opacity: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".testimonials", start: "top 80%" },
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

      ScrollTrigger.refresh();
    }, root);

    // Refresh ScrollTrigger after fonts settle and on full window load
    // so triggers compute against the final layout, not the pre-font one.
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

  // IntersectionObserver fallback: if GSAP somehow fails to load (CSP,
  // CDN miss, ancient browser), reveal everything that started hidden
  // so the page is still legible. Runs after a short grace period;
  // GSAP's gsap.set above marks elements via inline style, so we only
  // unhide if those styles are still present.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!root.current) return;
      const hidden = root.current.querySelectorAll<HTMLElement>(
        ".hero-eyebrow, .hero-word, .hero-line, .hero-sub, .hero-cta, .hero-flip-card, .hero-glow",
      );
      hidden.forEach((el) => {
        if (el.style.opacity === "0" || el.style.transform.includes("scale")) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  const heroWords = ["The", "ref", "your", "group", "project", "never", "had."];
  const finalWords = [
    "Stop",
    "being",
    "the",
    "one",
    "who",
    "does",
    "everything.",
  ];

  return (
    <main ref={root} className="flex flex-1 flex-col">
      <GlobalKeyframes />

      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 40px", position: "relative", zIndex: 5 }}
      >
        <Wordmark />
        <nav
          style={{
            display: "flex",
            gap: 24,
            fontSize: 14,
            alignItems: "center",
          }}
        >
          <Link href="#how" className="lk-mute">
            How it works
          </Link>
          <Link href="/changelog" className="lk-mute">
            Changelog
          </Link>
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="pill pill-red"
              style={{ padding: "9px 16px", fontSize: 14 }}
            >
              Go to Dashboard →
            </Link>
          ) : (
            <Link href="/sign-in" className="lk-mute">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* ============== HERO ============== */}
      <section
        className="hero"
        style={{
          paddingTop: 80,
          paddingBottom: 140,
          paddingLeft: 32,
          paddingRight: 32,
          position: "relative",
          overflow: "hidden",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <ScoreboardBackground />

        <div
          aria-hidden
          className="hero-glow"
          style={{
            position: "absolute",
            top: "50%",
            left: "30%",
            width: 600,
            height: 600,
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.06) 35%, transparent 70%)",
            filter: "blur(80px)",
            pointerEvents: "none",
            zIndex: 0,
            willChange: "transform, opacity",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)",
            gap: 64,
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
          className="hero-grid"
        >
          <div>
            <div
              className="hero-eyebrow label"
              style={{
                marginBottom: 28,
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <WhistleIcon />
              An accountability layer for group projects
            </div>
            <h1
              className="display"
              style={{
                fontSize: "clamp(56px, 9.5vw, 144px)",
                margin: 0,
                fontWeight: 500,
                lineHeight: 0.96,
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
                    willChange: "transform, opacity",
                  }}
                >
                  {w}
                </span>
              ))}
            </h1>

            {/* Red line drawn left to right via SVG stroke-dashoffset
                wrapped in a scaleX shim so we get the same look without
                pixel-snapping issues. */}
            <svg
              aria-hidden
              width="100%"
              height="2"
              viewBox="0 0 1000 2"
              preserveAspectRatio="none"
              style={{ marginTop: 32, display: "block" }}
            >
              <line
                className="hero-line"
                x1="0"
                y1="1"
                x2="1000"
                y2="1"
                stroke="#DC2626"
                strokeWidth="2"
                style={{ transformOrigin: "0% 50%", willChange: "transform" }}
              />
            </svg>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 56,
                marginTop: 48,
              }}
              className="hero-sub-grid"
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
                  gap: 16,
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
          </div>

          {/* Hero right side — flipping referee card */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 380,
              perspective: 1200,
              position: "relative",
              zIndex: 2,
            }}
            className="hero-card-stage"
          >
            <FlippingRefCard />
          </div>
        </div>
      </section>

      <ScoreTicker />

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
          className="problem-grid"
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

      <SectionDivider />

      {/* ============== HOW IT WORKS ============== */}
      <section id="how" className="wrap" style={{ padding: "120px 40px" }}>
        <div className="label" style={{ marginBottom: 56 }}>
          How it works
        </div>
        <div
          className="how-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 1fr 1fr 1fr",
            gap: 40,
          }}
        >
          <div />
          <Step
            n={1}
            t="Connect your project"
            b="Create a project, invite your team, and link your GitHub repo. GPR starts watching from day one."
          />
          <Step
            n={2}
            t="Run your meeting normally"
            b="After any meeting, paste or upload the transcript. Voice notes, Zoom exports, copied Slack threads — GPR reads it all."
          />
          <Step
            n={3}
            t="The ref calls it"
            b="GPR extracts every commitment, scores every member, and issues cards automatically. Yellow for falling behind. Red for going dark. MVP for carrying the squad."
          />
          <Step
            n={4}
            t="Evidence builds over time"
            b="Every meeting adds to your project knowledge base. Ask GPR anything — who committed to what, what was decided, who has been quiet for a week."
          />
        </div>
        <style>{`
          @media (max-width: 1024px) {
            .how-grid { grid-template-columns: 60px 1fr 1fr !important; }
          }
          @media (max-width: 640px) {
            .how-grid { grid-template-columns: 1fr !important; }
            .how-grid > div:first-child { display: none; }
          }
        `}</style>
      </section>

      <SectionDivider />

      {/* ============== THREE CALLS — dealt cards ============== */}
      <section className="three-calls wrap" style={{ padding: "120px 40px" }}>
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
          className="calls-grid"
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
            shake
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

      <SectionDivider />

      {/* ============== MATCH REPORT MOCKUP ============== */}
      <section className="wrap" style={{ padding: "120px 40px" }}>
        <div className="label" style={{ marginBottom: 24 }}>
          A real match report
        </div>
        <h2
          className="display"
          style={{
            margin: 0,
            marginBottom: 48,
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
            padding: 0,
            maxWidth: 880,
            overflow: "hidden",
            willChange: "transform",
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              height: 3,
              background: "var(--red)",
            }}
          />
          {/* Live ticker tape across the top of the report */}
          <MatchTickerTape />

          <div style={{ padding: 32 }}>
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

            <p
              className="body match-summary"
              style={{
                margin: "0 0 18px",
                color: "var(--ink-2, var(--ink))",
                lineHeight: 1.55,
                fontSize: 15,
              }}
            >
              Two members carried the load. One has not delivered in eleven
              days. Detailed verdict and commitments below.
            </p>

            <MatchRow rank={1} name="Jordan" role="frontend" score={94} kind="mvp" />
            <MatchRow rank={2} name="Maya" role="backend" score={88} kind={null} />
            <MatchRow rank={3} name="Priya" role="design" score={82} kind={null} />
            <MatchRow rank={4} name="Sam" role="QA" score={71} kind="y" />
            <MatchRow rank={5} name="Riley" role="ops" score={67} kind="y" />
            <MatchRow rank={6} name="Morgan" role="research" score={55} kind={null} />
            <MatchRow rank={7} name="Alex" role="PM" score={45} kind="r" />
            <MatchRow rank={8} name="Casey" role="content" score={12} kind="r" isLast />

            <div
              style={{
                marginTop: 22,
                paddingTop: 18,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div className="label" style={{ marginBottom: 12 }}>
                Open commitments
              </div>
              <CommitmentLine
                who="Jordan"
                text="Finalize the API contract by Thursday EOD."
                due="Thu"
                done
              />
              <CommitmentLine
                who="Maya"
                text="Migrate auth middleware before next stand-up."
                due="Mon"
              />
              <CommitmentLine
                who="Sam"
                text="Send the stakeholder update with sprint metrics."
                due="3 days ago"
                overdue
              />
              <CommitmentLine
                who="Casey"
                text="Reply to anything in the channel."
                due="11 days ago"
                overdue
              />
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

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
          className="features-grid"
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

      <SectionDivider />

      {/* ============== TESTIMONIALS ============== */}
      <section
        className="testimonials wrap"
        style={{ padding: "120px 40px" }}
      >
        <div className="label" style={{ marginBottom: 24 }}>
          Field reports
        </div>
        <h2
          className="display"
          style={{
            margin: 0,
            marginBottom: 56,
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 500,
            lineHeight: 1.05,
            maxWidth: 960,
          }}
        >
          The ref keeps receipts.{" "}
          <span className="mute-ink">People notice.</span>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
          className="testimonial-grid"
        >
          <Testimonial
            quote="I used to be the one doing everything. Now I have proof."
            name="Final year CS student"
            role="University of Canterbury"
          />
          <Testimonial
            quote="Our group project went from chaos to accountability in one meeting."
            name="Product team"
            role="Early-stage startup"
          />
          <Testimonial
            quote="The red card on my teammate was the most satisfying thing I have ever seen."
            name="Anonymous"
            role="…but we know who"
          />
        </div>
        <style>{`
          @media (max-width: 880px) {
            .testimonial-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      <SectionDivider />

      {/* ============== FINAL CTA ============== */}
      <section className="final-cta wrap" style={{ padding: "120px 40px" }}>
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
          <ConfettiCtaButton href={ctaHref}>
            {isSignedIn ? "Open dashboard →" : "Start for free →"}
          </ConfettiCtaButton>
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

      <PublicFooter />

      <style>{`
        @media (max-width: 980px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-card-stage { display: none !important; }
          .hero-sub-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .problem-grid, .calls-grid, .features-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

// ============== SCORE TICKER (continuous broadcast) ==============

function ScoreTicker() {
  // Render the ticker entries twice so the CSS animation can scroll
  // -50% and seamlessly loop.
  const doubled = [...TICKER_ENTRIES, ...TICKER_ENTRIES];
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background: "var(--paper)",
        padding: "10px 0",
      }}
    >
      <div className="ticker-row" style={{ display: "flex", whiteSpace: "nowrap" }}>
        {doubled.map((t, i) => (
          <span
            key={i}
            className="num"
            style={{
              padding: "0 28px",
              fontSize: 13,
              letterSpacing: "0.04em",
              color: "var(--ink-2, var(--ink))",
              borderRight: "1px solid var(--line-2, var(--line))",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>
              {t.score}pts
            </span>
            {t.badge && <span aria-hidden>{t.badge}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============== MATCH REPORT TICKER (above mockup) ==============

function MatchTickerTape() {
  const doubled = [...TICKER_ENTRIES, ...TICKER_ENTRIES];
  return (
    <div
      aria-hidden
      style={{
        overflow: "hidden",
        background: "rgba(220, 38, 38, 0.04)",
        borderBottom: "1px solid var(--line)",
        padding: "8px 0",
      }}
    >
      <div className="ticker-row-fast" style={{ display: "flex", whiteSpace: "nowrap" }}>
        {doubled.map((t, i) => (
          <span
            key={i}
            className="num"
            style={{
              padding: "0 22px",
              fontSize: 12,
              color: "var(--mute)",
              letterSpacing: "0.04em",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
              {t.name.toUpperCase()}
            </span>
            <span style={{ color: "var(--red)" }}>{t.score}</span>
            {t.badge && <span>{t.badge}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============== HERO RIGHT — flipping referee card ==============

function FlippingRefCard() {
  return (
    <div
      className="hero-flip-card"
      style={{
        position: "relative",
        width: 220,
        height: 320,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {/* Card body with a subtle inner gradient and a name tag */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(160deg, #DC2626 0%, #B91C1C 60%, #991B1B 100%)",
          borderRadius: 10,
          boxShadow:
            "0 30px 70px -28px rgba(220,38,38,0.6), 0 0 0 1px rgba(0,0,0,0.06)",
          padding: 22,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "inherit",
        }}
      >
        <div>
          <div
            className="label"
            style={{
              color: "rgba(255,255,255,0.78)",
              fontSize: 11,
              letterSpacing: "0.18em",
              marginBottom: 8,
            }}
          >
            RED CARD · 88'
          </div>
          <div
            className="display"
            style={{
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            Casey
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.72)",
              marginTop: 4,
            }}
          >
            content · sub
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <span
            className="num display"
            style={{ fontSize: 60, fontWeight: 500, lineHeight: 1 }}
          >
            12
          </span>
          <span
            className="label num"
            style={{
              fontSize: 10,
              opacity: 0.78,
              letterSpacing: "0.18em",
              transform: "rotate(180deg)",
            }}
          >
            GPR
          </span>
        </div>
      </div>
    </div>
  );
}

// ============== HERO BACKGROUND — scoreboard counters ==============

function ScoreboardBackground() {
  // 5 faint counters arranged loosely. Pure decoration; aria-hidden.
  const positions: Array<React.CSSProperties> = [
    { top: "8%", left: "6%", fontSize: 60 },
    { top: "20%", right: "30%", fontSize: 80 },
    { top: "70%", left: "20%", fontSize: 90 },
    { top: "50%", right: "8%", fontSize: 56 },
    { top: "85%", right: "26%", fontSize: 70 },
  ];
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {positions.map((p, i) => (
        <span
          key={i}
          className="scoreboard-digit num display"
          style={{
            position: "absolute",
            ...p,
            color: "rgba(220, 38, 38, 0.06)",
            fontWeight: 500,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            willChange: "contents",
          }}
        >
          00
        </span>
      ))}
    </div>
  );
}

// ============== WHISTLE ICON ==============

function WhistleIcon() {
  return (
    <span
      aria-hidden
      className="whistle-spin"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        color: "var(--red)",
        willChange: "transform",
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <path
          d="M3 11a5 5 0 0 1 5-5h7l5-2v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="11" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

// ============== STEP (split-flap counter) ==============

function Step({ n, t, b }: { n: number; t: string; b: string }) {
  return (
    <div className="step-block">
      <div
        className="step-num num display"
        data-target={n}
        style={{
          fontSize: 36,
          fontWeight: 500,
          color: "var(--red)",
          marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
          willChange: "contents, transform",
          minWidth: "2ch",
          display: "inline-block",
        }}
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

// Drive the split-flap effect: rapidly cycle through a sequence of
// random digits with a vertical 3D flip on each tick, then settle on
// the target number.
function animateSplitFlap(el: HTMLElement, target: number) {
  const finalText = String(target).padStart(2, "0");
  const ticks = 14;
  let i = 0;
  const tick = () => {
    if (i >= ticks) {
      el.textContent = finalText;
      gsap.fromTo(
        el,
        { rotateX: -90 },
        { rotateX: 0, duration: 0.35, ease: "back.out(2.4)" },
      );
      return;
    }
    const fake = String(Math.floor(Math.random() * 100)).padStart(2, "0");
    el.textContent = fake;
    gsap.fromTo(
      el,
      { rotateX: -90 },
      { rotateX: 0, duration: 0.06, ease: "power1.out" },
    );
    i += 1;
    setTimeout(tick, 50 + i * 6);
  };
  tick();
}

// ============== CARD SPEC — three calls section ==============

function CardSpec({
  kind,
  title,
  sub,
  body,
  rotate,
  shake,
}: {
  kind: RefCardKind;
  title: string;
  sub: string;
  body: string;
  rotate: number;
  shake?: boolean;
}) {
  return (
    <div className={`deal-card${shake ? " deal-card-shake" : ""}`} style={{ willChange: "transform" }}>
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

// ============== PROBLEM CARD with red X stamp ==============

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
        willChange: "transform",
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
      <div
        className="red-x-stamp"
        style={{
          width: 64,
          height: 64,
          willChange: "transform, opacity",
        }}
      >
        <RedX />
      </div>
      <div
        className="label"
        style={{ color: "var(--red)", marginTop: 16, marginBottom: 12 }}
      >
        {kicker}
      </div>
      <div className="h-s" style={{ fontSize: 22, lineHeight: 1.25 }}>
        {headline}
      </div>
    </article>
  );
}

function RedX() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      <line
        x1="10"
        y1="10"
        x2="54"
        y2="54"
        stroke="var(--red)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="54"
        y1="10"
        x2="10"
        y2="54"
        stroke="var(--red)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============== FEATURE CARD ==============

function Feature({ title, copy }: { title: string; copy: string }) {
  return (
    <article
      className="feature-card"
      style={{
        padding: "26px 24px",
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--paper)",
        transition:
          "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
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

// ============== TESTIMONIAL ==============

function Testimonial({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) {
  return (
    <figure
      className="testimonial"
      style={{
        margin: 0,
        padding: "26px 24px",
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--paper)",
        position: "relative",
        transition:
          "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "var(--red)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.borderColor = "";
      }}
    >
      <blockquote
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.4,
          color: "var(--ink)",
        }}
      >
        “{quote}”
      </blockquote>
      <figcaption
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "var(--mute)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{name}</span>
        <span> · {role}</span>
      </figcaption>
    </figure>
  );
}

// ============== COMMITMENT LINE ==============

function CommitmentLine({
  who,
  text,
  due,
  overdue,
  done,
}: {
  who: string;
  text: string;
  due: string;
  overdue?: boolean;
  done?: boolean;
}) {
  const dueColor = done
    ? "var(--mute)"
    : overdue
      ? "var(--red)"
      : "var(--ink)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px minmax(0, 1fr) auto",
        gap: 12,
        padding: "8px 0",
        alignItems: "center",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: done
            ? "var(--mute, #9ca3af)"
            : overdue
              ? "var(--red)"
              : "var(--ink)",
          opacity: done ? 0.6 : 1,
          marginLeft: 3,
        }}
      />
      <span
        style={{
          fontSize: 14,
          color: done ? "var(--mute)" : "var(--ink)",
          textDecoration: done ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: 600 }}>{who}</span>
        <span className="mute-ink" style={{ fontWeight: 400 }}>
          {" "}
          — {text}
        </span>
      </span>
      <span
        className="num"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: dueColor,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        {due}
      </span>
    </div>
  );
}

// ============== MATCH ROW ==============

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
        padding: "16px 0",
        borderBottom: isLast ? "none" : "1px solid var(--line-2, var(--line))",
      }}
    >
      <span
        className="num display"
        style={{
          fontSize: 20,
          color: "var(--mute-2, var(--mute))",
          fontWeight: 500,
        }}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <div className="match-name" style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
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
            fontSize: 36,
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

// ============== CONFETTI CTA BUTTON ==============

function ConfettiCtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [bursts, setBursts] = useState<number[]>([]);
  const onEnter = () => {
    setBursts((prev) => [...prev, Date.now()]);
  };
  // Clean up old confetti runs after they finish.
  useEffect(() => {
    if (bursts.length === 0) return;
    const t = setTimeout(() => {
      setBursts((prev) => prev.slice(1));
    }, 1100);
    return () => clearTimeout(t);
  }, [bursts]);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <Link
        href={href}
        className="final-button pill pill-red cta-pulse"
        onMouseEnter={onEnter}
        style={{
          padding: "16px 28px",
          fontSize: 15,
          borderRadius: 999,
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </Link>
      {bursts.map((id) => (
        <ConfettiBurst key={id} />
      ))}
    </span>
  );
}

function ConfettiBurst() {
  // Spawn 14 particles with randomized trajectories. Pure inline CSS
  // animation — no GSAP needed; cleans up on unmount.
  const particles = Array.from({ length: 14 }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
    const dist = 50 + Math.random() * 60;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20;
    const red = i % 2 === 0;
    const size = 6 + Math.random() * 4;
    const rot = Math.random() * 720 - 360;
    const dur = 700 + Math.random() * 350;
    return { i, dx, dy, red, size, rot, dur };
  });
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {particles.map((p) => (
        <span
          key={p.i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            background: p.red ? "#DC2626" : "#ffffff",
            border: p.red ? "none" : "1px solid #DC2626",
            borderRadius: 2,
            transform: `translate(-50%, -50%)`,
            ["--cx" as string]: `${p.dx}px`,
            ["--cy" as string]: `${p.dy}px`,
            ["--cr" as string]: `${p.rot}deg`,
            animation: `confetti ${p.dur}ms ease-out forwards`,
          }}
        />
      ))}
    </span>
  );
}

// ============== SECTION DIVIDER ==============

function SectionDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        margin: "0 0",
        background:
          "linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.55) 50%, transparent 100%)",
        opacity: 0.7,
      }}
    />
  );
}

// ============== KEYFRAMES (single global block) ==============

function GlobalKeyframes() {
  return (
    <style>{`
      /* Continuous broadcast tickers */
      @keyframes tickerScroll {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      .ticker-row {
        animation: tickerScroll 38s linear infinite;
        will-change: transform;
      }
      .ticker-row-fast {
        animation: tickerScroll 22s linear infinite;
        will-change: transform;
      }

      /* Whistle: single spin on load, then idle */
      @keyframes whistleSpin {
        0%   { transform: rotate(0deg); }
        70%  { transform: rotate(380deg); }
        85%  { transform: rotate(355deg); }
        100% { transform: rotate(360deg); }
      }
      .whistle-spin {
        animation: whistleSpin 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) 1 both;
      }

      /* Final CTA pulse (continuous red glow) */
      @keyframes ctaPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
        50%      { box-shadow: 0 0 36px 6px rgba(220, 38, 38, 0.45); }
      }
      .cta-pulse {
        animation: ctaPulse 1.8s ease-in-out infinite;
        will-change: box-shadow;
      }

      /* Red-card hover shake — sent off the pitch */
      @keyframes redCardShake {
        0%, 100% { transform: translateX(0) rotate(0); }
        15%      { transform: translateX(-4px) rotate(-2deg); }
        30%      { transform: translateX(4px) rotate(2deg); }
        45%      { transform: translateX(-3px) rotate(-1.5deg); }
        60%      { transform: translateX(3px) rotate(1.5deg); }
        75%      { transform: translateX(-2px) rotate(-1deg); }
      }
      .deal-card-shake:hover {
        animation: redCardShake 0.55s ease-in-out;
      }

      /* Confetti burst — particles fly out and fade */
      @keyframes confetti {
        0%   { opacity: 1; transform: translate(-50%, -50%) rotate(0deg); }
        100% {
          opacity: 0;
          transform: translate(calc(-50% + var(--cx)), calc(-50% + var(--cy))) rotate(var(--cr));
        }
      }

      /* Reduced motion — keep page legible without spinning chrome */
      @media (prefers-reduced-motion: reduce) {
        .ticker-row, .ticker-row-fast, .whistle-spin, .cta-pulse {
          animation: none !important;
        }
      }
    `}</style>
  );
}
