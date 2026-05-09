"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  GitCommit,
  Layers,
  ScrollText,
  Trophy,
  Zap,
} from "lucide-react";
import { RefCard } from "@/components/ref-card";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const RED = "#DC2626";

type Cta = { label: string; href: string };

function useCtas(): { primary: Cta; secondary: Cta } {
  const { isSignedIn } = useUser();
  if (isSignedIn) {
    return {
      primary: { label: "Go to dashboard", href: "/dashboard" },
      secondary: { label: "Open dashboard", href: "/dashboard" },
    };
  }
  return {
    primary: { label: "Get started — free", href: "/sign-up" },
    secondary: { label: "Sign in", href: "/sign-in" },
  };
}

export function LandingPage() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      // Hero — word-by-word headline
      const titleWords = gsap.utils.toArray<HTMLElement>(".hero-word");
      gsap.set(titleWords, { yPercent: 110, opacity: 0 });
      gsap.set(".hero-eyebrow", { y: 16, opacity: 0 });
      gsap.set(".hero-sub", { y: 24, opacity: 0 });
      gsap.set(".hero-line", { scaleX: 0, transformOrigin: "0% 50%" });
      gsap.set(".hero-cta", { y: 24, opacity: 0, scale: 0.92 });
      gsap.set(".hero-card", { y: 40, opacity: 0, rotate: -4 });

      const heroTl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });
      heroTl
        .to(".hero-eyebrow", { y: 0, opacity: 1, duration: 0.6 })
        .to(
          titleWords,
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.06,
            ease: "expo.out",
          },
          "-=0.2",
        )
        .to(
          ".hero-sub",
          { y: 0, opacity: 1, duration: 0.7 },
          "-=0.4",
        )
        .to(
          ".hero-line",
          { scaleX: 1, duration: 0.9, ease: "power4.inOut" },
          "-=0.5",
        )
        .to(
          ".hero-cta",
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "back.out(1.6)",
          },
          "-=0.5",
        )
        .to(
          ".hero-card",
          { y: 0, opacity: 1, rotate: 0, duration: 0.9 },
          "-=0.7",
        );

      // Hero card mouse-tilt
      const card = root.current?.querySelector<HTMLElement>(".hero-card");
      const heroSection = root.current?.querySelector<HTMLElement>(".hero");
      const onMove = (e: MouseEvent) => {
        if (!card || !heroSection) return;
        const r = heroSection.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width - 0.5;
        const cy = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, {
          rotateY: cx * 16,
          rotateX: -cy * 14,
          y: -cy * 12,
          duration: 0.6,
          ease: "power2.out",
        });
      };
      const onLeave = () => {
        if (!card) return;
        gsap.to(card, {
          rotateY: 0,
          rotateX: 0,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
        });
      };
      heroSection?.addEventListener("mousemove", onMove);
      heroSection?.addEventListener("mouseleave", onLeave);

      // Parallax ribbon behind hero
      gsap.to(".hero-glow", {
        yPercent: -25,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });

      // Problem cards — slide in
      gsap.from(".problem-card", {
        y: 60,
        opacity: 0,
        scale: 0.96,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".problem",
          start: "top 75%",
        },
      });
      gsap.from(".problem-x svg", {
        scale: 0,
        rotate: -90,
        transformOrigin: "50% 50%",
        duration: 0.7,
        stagger: 0.18,
        ease: "back.out(1.8)",
        scrollTrigger: {
          trigger: ".problem",
          start: "top 70%",
        },
      });

      // Section titles — split-reveal
      gsap.utils.toArray<HTMLElement>(".section-title").forEach((el) => {
        gsap.from(el, {
          y: 50,
          opacity: 0,
          duration: 1.0,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 82%" },
        });
      });
      gsap.utils.toArray<HTMLElement>(".section-eyebrow").forEach((el) => {
        gsap.from(el, {
          y: 14,
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // How it works — step number count up + reveal
      gsap.utils
        .toArray<HTMLElement>(".step")
        .forEach((stepEl, idx) => {
          const numEl = stepEl.querySelector<HTMLElement>(".step-num");
          gsap.from(stepEl, {
            x: idx % 2 === 0 ? -40 : 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: stepEl, start: "top 80%" },
          });
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
              scrollTrigger: { trigger: stepEl, start: "top 80%" },
            });
          }
        });

      // Match report — flip cards in
      gsap.from(".mr-card", {
        rotateY: 90,
        opacity: 0,
        transformOrigin: "0% 50%",
        duration: 0.9,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".match-report",
          start: "top 70%",
        },
      });
      // count-up scores in match report
      gsap.utils.toArray<HTMLElement>(".mr-score").forEach((el) => {
        const target = Number(el.dataset.target ?? "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v));
          },
          scrollTrigger: {
            trigger: ".match-report",
            start: "top 65%",
          },
        });
      });

      // Features grid stagger
      gsap.from(".feature-card", {
        y: 50,
        opacity: 0,
        scale: 0.96,
        duration: 0.7,
        stagger: { each: 0.08, grid: "auto", from: "start" },
        ease: "power3.out",
        scrollTrigger: { trigger: ".features", start: "top 78%" },
      });

      // Testimonials
      gsap.from(".testimonial", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".testimonials", start: "top 78%" },
      });

      // Final CTA scale in
      gsap.from(".final-cta-inner", {
        scale: 0.94,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: ".final-cta", start: "top 85%" },
      });

      return () => {
        heroSection?.removeEventListener("mousemove", onMove);
        heroSection?.removeEventListener("mouseleave", onLeave);
      };
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="lp-root">
      <LandingStyles />
      <Header />
      <Hero />
      <Problem />
      <HowItWorks />
      <MatchReportMockup />
      <Features />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Header() {
  const ctas = useCtas();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="lp-header-inner">
        <Link href="/" className="lp-logo" aria-label="GPR home">
          <span className="lp-logo-mark" aria-hidden>
            <span className="lp-logo-dot" />
          </span>
          <span className="lp-logo-text">GPR</span>
        </Link>
        <nav className="lp-nav">
          <a href="#problem">Problem</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <div className="lp-header-cta">
          <Link href={ctas.secondary.href} className="lp-link">
            {ctas.secondary.label}
          </Link>
          <Link href={ctas.primary.href} className="lp-btn lp-btn-primary">
            {ctas.primary.label}
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const ctas = useCtas();
  const headline = ["Every", "project", "needs", "a", "ref."];
  return (
    <section className="hero" id="top">
      <div className="hero-glow" aria-hidden />
      <div className="hero-grain" aria-hidden />
      <div className="lp-wrap hero-inner">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="lp-eyebrow-dot" />
            AI accountability for group projects
          </div>
          <h1 className="hero-title">
            {headline.map((w, i) => (
              <span className="hero-word-wrap" key={i}>
                <span
                  className={`hero-word ${
                    w.toLowerCase().includes("ref") ? "is-red" : ""
                  }`}
                >
                  {w}
                </span>
              </span>
            ))}
          </h1>
          <div className="hero-line" />
          <p className="hero-sub">
            GPR reads every meeting transcript, tracks every commitment,
            watches every commit, and assigns a contribution score that no
            one can argue with. The AI is the referee. The ref&apos;s
            decision is final.
          </p>
          <div className="hero-cta-row">
            <Link
              href={ctas.primary.href}
              className="hero-cta lp-btn lp-btn-primary lp-btn-lg"
            >
              {ctas.primary.label}
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <Link
              href="#how"
              className="hero-cta lp-btn lp-btn-ghost lp-btn-lg"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="hero-card-wrap">
          <div className="hero-card">
            <div className="hero-card-glow" aria-hidden />
            <div className="hero-card-head">
              <div className="hero-card-eyebrow">Match report</div>
              <div className="hero-card-tag">FINAL</div>
            </div>
            <div className="hero-card-name">Maya Chen</div>
            <div className="hero-card-role">frontend · sprint 04</div>
            <div className="hero-card-score">
              <span className="num">94</span>
              <span className="hero-card-trend">+12</span>
            </div>
            <div className="hero-card-meta">
              <div className="hero-card-row">
                <span>commitments hit</span>
                <span className="num">7/7</span>
              </div>
              <div className="hero-card-row">
                <span>commits</span>
                <span className="num">23</span>
              </div>
              <div className="hero-card-row">
                <span>cards</span>
                <span className="hero-card-cards">
                  <RefCard kind="mvp" size={16} />
                </span>
              </div>
            </div>
            <div className="hero-card-stripe" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const items = [
    {
      kicker: "The ghost",
      title: "Joins three meetings, says nothing, vanishes.",
      body: "Then writes their name on the final report and asks for credit. Sound familiar?",
    },
    {
      kicker: "The procrastinator",
      title: "Promises Tuesday. Delivers Friday. Sometimes.",
      body: "By then someone else has rebuilt it. Their name still goes on the rubric.",
    },
    {
      kicker: "The carrier",
      title: "Pulls the all-nighter so the team doesn't fail.",
      body: "Gets the same grade as the ghost. Resents the project for years.",
    },
  ];
  return (
    <section className="problem section" id="problem">
      <div className="lp-wrap">
        <div className="section-eyebrow">The problem</div>
        <h2 className="section-title">
          You&apos;ve been on this team before.
        </h2>
        <div className="problem-grid">
          {items.map((it, i) => (
            <article className="problem-card" key={i}>
              <div className="problem-x" aria-hidden>
                <RedX />
              </div>
              <div className="problem-kicker">{it.kicker}</div>
              <h3 className="problem-title">{it.title}</h3>
              <p className="problem-body">{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RedX() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
      <line
        x1="6"
        y1="6"
        x2="34"
        y2="34"
        stroke={RED}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="34"
        y1="6"
        x2="6"
        y2="34"
        stroke={RED}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: "Drop the transcript.",
      body: "After each meeting, paste your Zoom, Meet, or Otter transcript into GPR. The model reads everything. No manual notes, no he-said-she-said.",
    },
    {
      n: 2,
      title: "Connect the work.",
      body: "Plug in GitHub. GPR pulls every commit and PR, attributes it to the right teammate, and weighs it against the commitments people made out loud.",
    },
    {
      n: 3,
      title: "The ref scores everyone.",
      body: "Cumulative contribution scores, MVP cards, yellow cards, red cards. Stamped automatically. No one — not even the captain — can override the ref.",
    },
  ];
  return (
    <section className="how section" id="how">
      <div className="lp-wrap">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-title">
          Three steps. Zero negotiations.
        </h2>
        <div className="step-list">
          {steps.map((s) => (
            <div className="step" key={s.n}>
              <div
                className="step-num display-font"
                data-target={s.n}
              >
                00
              </div>
              <div className="step-body">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-text">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchReportMockup() {
  const rows = [
    { name: "Maya Chen", role: "frontend", score: 94, kind: "mvp" as const },
    { name: "Diego Park", role: "backend", score: 71, kind: null },
    { name: "Jordan R.", role: "design", score: 58, kind: "y" as const },
    { name: "Sam K.", role: "PM", score: 22, kind: "r" as const },
  ];
  return (
    <section className="match-report section">
      <div className="lp-wrap">
        <div className="section-eyebrow">A real match report</div>
        <h2 className="section-title">
          Receipts. With timestamps.
        </h2>
        <div className="mr-frame">
          <div className="mr-head">
            <div>
              <div className="mr-eyebrow">Sprint 04 · Meeting recap</div>
              <div className="mr-title">Project Falcon</div>
            </div>
            <div className="mr-stamp">FINAL</div>
          </div>
          {rows.map((r, i) => (
            <div className="mr-card" key={i}>
              <div className="mr-rank num">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mr-id">
                <div className="mr-name">{r.name}</div>
                <div className="mr-role">{r.role}</div>
              </div>
              <div className="mr-cards-cell">
                {r.kind && <RefCard kind={r.kind} size={20} />}
              </div>
              <div className="mr-score-wrap">
                <span
                  className="mr-score num display-font"
                  data-target={r.score}
                >
                  0
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: <ScrollText size={18} strokeWidth={2.2} />,
      title: "Meeting analysis",
      copy: "Paste a transcript. Get a per-person breakdown in seconds.",
    },
    {
      icon: <Bot size={18} strokeWidth={2.2} />,
      title: "Ask GPR",
      copy: "An AI that has read every meeting your team has ever had.",
    },
    {
      icon: <Trophy size={18} strokeWidth={2.2} />,
      title: "Live leaderboard",
      copy: "Cumulative scores, MVPs, and yellow cards. Public to the squad.",
    },
    {
      icon: <GitCommit size={18} strokeWidth={2.2} />,
      title: "GitHub integration",
      copy: "Commits and PRs auto-attributed to the right teammate.",
    },
    {
      icon: <Layers size={18} strokeWidth={2.2} />,
      title: "Multi-source tracking",
      copy: "Meetings, commits, commitments, and cards — one score.",
    },
    {
      icon: <Zap size={18} strokeWidth={2.2} />,
      title: "Knowledge base",
      copy: "Every commitment your team made, searchable forever.",
    },
  ];
  return (
    <section className="features section" id="features">
      <div className="lp-wrap">
        <div className="section-eyebrow">Capabilities</div>
        <h2 className="section-title">
          Built for teams that are sick of carrying.
        </h2>
        <div className="feature-grid">
          {items.map((it, i) => (
            <article className="feature-card" key={i}>
              <div className="feature-icon">{it.icon}</div>
              <h3 className="feature-title">{it.title}</h3>
              <p className="feature-copy">{it.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      quote:
        "I used to spend Sunday nights pulling slack threads to prove who said what. Now the ref does it. We just look at the score and move on.",
      name: "Priya N.",
      role: "Senior · CS group project",
    },
    {
      quote:
        "Two of my cofounders saw their first red card and the energy shifted overnight. It's like having a brutally honest fourth person on the team.",
      name: "Marcus L.",
      role: "Startup, 4-person team",
    },
    {
      quote:
        "I got my first MVP in week three. I've never worked harder for a tiny gold star in my life.",
      name: "Avery K.",
      role: "Capstone team lead",
    },
  ];
  return (
    <section className="testimonials section">
      <div className="lp-wrap">
        <div className="section-eyebrow">Field reports</div>
        <h2 className="section-title">
          The ref keeps receipts. People notice.
        </h2>
        <div className="testimonial-grid">
          {items.map((t, i) => (
            <figure className="testimonial" key={i}>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption>
                <span className="t-name">{t.name}</span>
                <span className="t-role">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const ctas = useCtas();
  return (
    <section className="final-cta section">
      <div className="lp-wrap final-cta-inner">
        <div className="section-eyebrow">Last call</div>
        <h2 className="final-cta-title">
          Stop carrying the team.
          <br />
          <span className="is-red">Let the ref call it.</span>
        </h2>
        <p className="final-cta-sub">
          The first project is free. After that you&apos;ll wonder how you
          survived without it.
        </p>
        <Link
          href={ctas.primary.href}
          className="lp-btn lp-btn-primary lp-btn-xl"
        >
          {ctas.primary.label}
          <ArrowRight size={18} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <div className="lp-footer-brand">
          <span className="lp-logo-mark" aria-hidden>
            <span className="lp-logo-dot" />
          </span>
          <span>GPR</span>
        </div>
        <div className="lp-footer-meta">
          The AI is the referee. The ref&apos;s decision is final.
        </div>
      </div>
    </footer>
  );
}

function LandingStyles() {
  return (
    <style jsx global>{`
      .lp-root {
        --lp-bg: #0a0a0a;
        --lp-fg: #ffffff;
        --lp-mute: #a3a3a3;
        --lp-mute-2: #6b6b6b;
        --lp-line: #1f1f1f;
        --lp-line-2: #2a2a2a;
        --lp-paper: #111111;
        --lp-red: ${RED};
        --lp-display: var(--font-anton), "Arial Narrow", system-ui,
          sans-serif;
        --lp-body: var(--font-space), -apple-system, BlinkMacSystemFont,
          "Segoe UI", system-ui, sans-serif;

        background: var(--lp-bg);
        color: var(--lp-fg);
        font-family: var(--lp-body);
        font-feature-settings: "ss01", "cv11";
        line-height: 1.5;
        min-height: 100vh;
        overflow-x: clip;
      }
      .lp-root .display-font,
      .lp-root .hero-title,
      .lp-root .section-title,
      .lp-root .final-cta-title {
        font-family: var(--lp-display);
        letter-spacing: 0.005em;
        font-weight: 400;
        text-transform: uppercase;
      }
      .lp-root .num {
        font-variant-numeric: tabular-nums;
      }

      .lp-wrap {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 28px;
        width: 100%;
      }

      /* Header */
      .lp-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 40;
        transition: background 0.3s ease, border-color 0.3s ease,
          backdrop-filter 0.3s ease;
        border-bottom: 1px solid transparent;
      }
      .lp-header.is-scrolled {
        background: rgba(10, 10, 10, 0.78);
        backdrop-filter: saturate(160%) blur(14px);
        -webkit-backdrop-filter: saturate(160%) blur(14px);
        border-bottom-color: var(--lp-line);
      }
      .lp-header-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px 28px;
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .lp-logo {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--lp-fg);
        text-decoration: none;
        font-family: var(--lp-display);
        font-size: 22px;
        letter-spacing: 0.04em;
      }
      .lp-logo-mark {
        position: relative;
        display: inline-block;
        width: 22px;
        height: 22px;
        background: var(--lp-red);
        border-radius: 4px;
      }
      .lp-logo-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 6px;
        height: 6px;
        background: var(--lp-fg);
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }
      .lp-nav {
        display: flex;
        gap: 26px;
        margin-left: 32px;
        font-size: 14px;
        color: var(--lp-mute);
      }
      .lp-nav a {
        color: inherit;
        text-decoration: none;
        transition: color 0.2s ease;
      }
      .lp-nav a:hover {
        color: var(--lp-fg);
      }
      .lp-header-cta {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .lp-link {
        color: var(--lp-mute);
        text-decoration: none;
        font-size: 14px;
        transition: color 0.2s ease;
      }
      .lp-link:hover {
        color: var(--lp-fg);
      }
      .lp-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 7px;
        border: 1px solid transparent;
        cursor: pointer;
        text-decoration: none;
        transition: transform 0.18s ease, background 0.2s ease,
          border-color 0.2s ease, color 0.2s ease;
        white-space: nowrap;
      }
      .lp-btn-primary {
        background: var(--lp-red);
        color: #fff;
        border-color: var(--lp-red);
      }
      .lp-btn-primary:hover {
        transform: translateY(-1px);
        background: #ef4444;
        border-color: #ef4444;
      }
      .lp-btn-ghost {
        background: transparent;
        color: var(--lp-fg);
        border-color: var(--lp-line-2);
      }
      .lp-btn-ghost:hover {
        border-color: #3a3a3a;
        background: rgba(255, 255, 255, 0.04);
      }
      .lp-btn-lg {
        padding: 14px 22px;
        font-size: 15px;
      }
      .lp-btn-xl {
        padding: 18px 30px;
        font-size: 17px;
        border-radius: 9px;
      }

      /* Hero */
      .hero {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        padding: 140px 0 80px;
        overflow: hidden;
        isolation: isolate;
      }
      .hero-glow {
        position: absolute;
        top: -10%;
        left: 30%;
        width: 80vw;
        height: 80vw;
        max-width: 1100px;
        max-height: 1100px;
        background:
          radial-gradient(
            circle at center,
            rgba(220, 38, 38, 0.28) 0%,
            rgba(220, 38, 38, 0.05) 35%,
            transparent 65%
          );
        filter: blur(40px);
        pointer-events: none;
        z-index: 0;
      }
      .hero-grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        opacity: 0.18;
        mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        background-size: 220px 220px;
      }
      .hero-inner {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
        gap: 60px;
        align-items: center;
      }
      @media (max-width: 900px) {
        .hero-inner {
          grid-template-columns: 1fr;
          gap: 60px;
        }
      }
      .hero-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 7px 14px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--lp-mute);
        border: 1px solid var(--lp-line-2);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.02);
        margin-bottom: 28px;
      }
      .lp-eyebrow-dot {
        width: 7px;
        height: 7px;
        background: var(--lp-red);
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(220, 38, 38, 0.7);
      }
      .hero-title {
        font-size: clamp(64px, 11.5vw, 168px);
        line-height: 0.92;
        margin: 0;
        color: var(--lp-fg);
      }
      .hero-word-wrap {
        display: inline-block;
        overflow: hidden;
        line-height: 1;
        margin-right: 0.18em;
        vertical-align: top;
      }
      .hero-word {
        display: inline-block;
        will-change: transform;
      }
      .hero-word.is-red {
        color: var(--lp-red);
      }
      .hero-line {
        height: 3px;
        width: min(360px, 60%);
        background: var(--lp-red);
        margin: 28px 0 28px;
        border-radius: 2px;
      }
      .hero-sub {
        font-size: clamp(15px, 1.4vw, 18px);
        color: var(--lp-mute);
        max-width: 560px;
        line-height: 1.55;
        margin: 0 0 32px;
      }
      .hero-cta-row {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }

      /* Hero card */
      .hero-card-wrap {
        perspective: 1200px;
        display: flex;
        justify-content: center;
      }
      .hero-card {
        position: relative;
        width: 320px;
        max-width: 100%;
        padding: 26px 24px 24px;
        background: linear-gradient(
          180deg,
          #161616 0%,
          #0e0e0e 100%
        );
        border: 1px solid var(--lp-line-2);
        border-radius: 14px;
        box-shadow:
          0 30px 80px -20px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(255, 255, 255, 0.02) inset;
        transform-style: preserve-3d;
        will-change: transform;
        overflow: hidden;
      }
      .hero-card-glow {
        position: absolute;
        top: -50%;
        right: -30%;
        width: 220px;
        height: 220px;
        background: radial-gradient(
          circle,
          rgba(220, 38, 38, 0.4) 0%,
          transparent 60%
        );
        filter: blur(20px);
        pointer-events: none;
      }
      .hero-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
        position: relative;
      }
      .hero-card-eyebrow {
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lp-mute);
      }
      .hero-card-tag {
        font-family: var(--lp-display);
        font-size: 12px;
        letter-spacing: 0.2em;
        color: var(--lp-red);
        border: 1px solid var(--lp-red);
        padding: 3px 8px;
        border-radius: 4px;
      }
      .hero-card-name {
        font-family: var(--lp-display);
        font-size: 32px;
        line-height: 1;
        letter-spacing: 0.02em;
      }
      .hero-card-role {
        font-size: 12px;
        color: var(--lp-mute);
        text-transform: lowercase;
        margin-top: 2px;
      }
      .hero-card-score {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin: 18px 0 14px;
      }
      .hero-card-score .num {
        font-family: var(--lp-display);
        font-size: 88px;
        line-height: 0.9;
        letter-spacing: -0.02em;
      }
      .hero-card-trend {
        font-size: 14px;
        font-weight: 700;
        color: #22c55e;
      }
      .hero-card-meta {
        border-top: 1px solid var(--lp-line);
        padding-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hero-card-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--lp-mute);
      }
      .hero-card-row .num {
        color: var(--lp-fg);
        font-weight: 600;
      }
      .hero-card-cards {
        display: inline-flex;
        align-items: center;
      }
      .hero-card-stripe {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(
          90deg,
          transparent,
          var(--lp-red),
          transparent
        );
      }

      /* Sections */
      .section {
        padding: 140px 0;
        position: relative;
      }
      @media (max-width: 700px) {
        .section {
          padding: 90px 0;
        }
      }
      .section-eyebrow {
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--lp-red);
        font-weight: 600;
        margin-bottom: 18px;
      }
      .section-title {
        font-size: clamp(40px, 6.5vw, 88px);
        line-height: 0.96;
        margin: 0 0 56px;
        max-width: 1100px;
      }

      /* Problem */
      .problem-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }
      @media (max-width: 900px) {
        .problem-grid {
          grid-template-columns: 1fr;
        }
      }
      .problem-card {
        position: relative;
        padding: 32px 28px 30px;
        background: var(--lp-paper);
        border: 1px solid var(--lp-line);
        border-radius: 12px;
        overflow: hidden;
        transition: transform 0.3s ease, border-color 0.3s ease;
      }
      .problem-card:hover {
        transform: translateY(-4px);
        border-color: var(--lp-line-2);
      }
      .problem-x {
        margin-bottom: 18px;
        opacity: 0.95;
      }
      .problem-kicker {
        font-family: var(--lp-display);
        font-size: 13px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lp-red);
        margin-bottom: 12px;
      }
      .problem-title {
        font-size: 22px;
        line-height: 1.25;
        margin: 0 0 12px;
        font-weight: 600;
        color: var(--lp-fg);
      }
      .problem-body {
        margin: 0;
        font-size: 14px;
        color: var(--lp-mute);
        line-height: 1.55;
      }

      /* How it works */
      .step-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
        max-width: 920px;
      }
      .step {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 28px;
        align-items: start;
        padding: 32px 0;
        border-top: 1px solid var(--lp-line);
      }
      @media (max-width: 700px) {
        .step {
          grid-template-columns: 1fr;
          gap: 12px;
        }
      }
      .step-num {
        font-size: 96px;
        line-height: 0.85;
        color: var(--lp-red);
      }
      .step-title {
        font-size: 26px;
        line-height: 1.2;
        margin: 0 0 10px;
        font-weight: 600;
      }
      .step-text {
        margin: 0;
        font-size: 16px;
        color: var(--lp-mute);
        line-height: 1.6;
        max-width: 620px;
      }

      /* Match report */
      .mr-frame {
        background: var(--lp-paper);
        border: 1px solid var(--lp-line);
        border-radius: 16px;
        padding: 28px;
        max-width: 840px;
        position: relative;
        overflow: hidden;
      }
      .mr-frame::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--lp-red);
      }
      .mr-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--lp-line);
        margin-bottom: 8px;
      }
      .mr-eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lp-mute);
      }
      .mr-title {
        font-family: var(--lp-display);
        font-size: 28px;
        letter-spacing: 0.02em;
      }
      .mr-stamp {
        font-family: var(--lp-display);
        font-size: 14px;
        letter-spacing: 0.22em;
        color: var(--lp-red);
        border: 1.5px solid var(--lp-red);
        padding: 6px 12px;
        border-radius: 4px;
        transform: rotate(-3deg);
      }
      .mr-card {
        display: grid;
        grid-template-columns: 50px minmax(0, 1fr) 50px 110px;
        gap: 18px;
        align-items: center;
        padding: 18px 0;
        border-bottom: 1px solid var(--lp-line);
        will-change: transform, opacity;
      }
      .mr-card:last-child {
        border-bottom: 0;
      }
      .mr-rank {
        font-family: var(--lp-display);
        font-size: 28px;
        color: var(--lp-mute-2);
      }
      .mr-name {
        font-size: 18px;
        font-weight: 600;
      }
      .mr-role {
        font-size: 12px;
        color: var(--lp-mute);
        text-transform: lowercase;
      }
      .mr-cards-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 22px;
      }
      .mr-score-wrap {
        text-align: right;
      }
      .mr-score {
        font-size: 56px;
        line-height: 1;
      }

      /* Features */
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }
      @media (max-width: 900px) {
        .feature-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .feature-grid {
          grid-template-columns: 1fr;
        }
      }
      .feature-card {
        padding: 30px 26px;
        background: var(--lp-paper);
        border: 1px solid var(--lp-line);
        border-radius: 12px;
        transition: transform 0.3s ease, border-color 0.3s ease,
          background 0.3s ease;
      }
      .feature-card:hover {
        transform: translateY(-6px);
        border-color: var(--lp-red);
        background: #131313;
      }
      .feature-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: rgba(220, 38, 38, 0.12);
        color: var(--lp-red);
        margin-bottom: 18px;
      }
      .feature-title {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 600;
      }
      .feature-copy {
        margin: 0;
        font-size: 14px;
        color: var(--lp-mute);
        line-height: 1.55;
      }

      /* Testimonials */
      .testimonial-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }
      @media (max-width: 900px) {
        .testimonial-grid {
          grid-template-columns: 1fr;
        }
      }
      .testimonial {
        margin: 0;
        padding: 28px 26px;
        background: var(--lp-paper);
        border: 1px solid var(--lp-line);
        border-radius: 12px;
        position: relative;
      }
      .testimonial blockquote {
        margin: 0 0 18px;
        font-size: 16px;
        line-height: 1.55;
        color: var(--lp-fg);
      }
      .testimonial figcaption {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .t-name {
        font-weight: 600;
        font-size: 14px;
      }
      .t-role {
        font-size: 12px;
        color: var(--lp-mute);
      }

      /* Final CTA */
      .final-cta {
        padding: 160px 0 180px;
        position: relative;
        overflow: hidden;
        text-align: center;
      }
      .final-cta::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(220, 38, 38, 0.18) 0%,
          transparent 60%
        );
        pointer-events: none;
      }
      .final-cta-inner {
        position: relative;
      }
      .final-cta-title {
        font-size: clamp(48px, 9vw, 132px);
        line-height: 0.96;
        margin: 0 0 24px;
      }
      .final-cta-title .is-red {
        color: var(--lp-red);
      }
      .final-cta-sub {
        font-size: 17px;
        color: var(--lp-mute);
        margin: 0 0 38px;
        max-width: 560px;
        margin-left: auto;
        margin-right: auto;
      }

      /* Footer */
      .lp-footer {
        border-top: 1px solid var(--lp-line);
        padding: 28px 0 36px;
      }
      .lp-footer-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .lp-footer-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-family: var(--lp-display);
        letter-spacing: 0.06em;
        font-size: 16px;
      }
      .lp-footer-meta {
        font-size: 12px;
        color: var(--lp-mute);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
    `}</style>
  );
}
