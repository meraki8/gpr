"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// useLayoutEffect logs a warning during SSR. Falling back to
// useEffect on the server keeps it quiet while still running
// pre-paint on the client so GSAP can set initial states before
// users see un-animated elements.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = {
  isSignedIn: boolean;
};

export function LandingClient({ isSignedIn }: Props) {
  const root = useRef<HTMLElement | null>(null);
  const ctaLabel = isSignedIn ? "Open dashboard →" : "Start for free →";
  const ctaHref = isSignedIn ? "/dashboard" : "/sign-up";

  useIsoLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      // ─── Hero word reveal ───
      gsap.set(".gpr-home .hero h1 .line", { yPercent: 110 });
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .to(
          ".gpr-home .hero h1 .line-1",
          { yPercent: 0, duration: 1.1, stagger: 0.06 },
          0.2,
        )
        .to(
          ".gpr-home .hero h1 .line-2",
          { yPercent: 0, duration: 1.1, stagger: 0.06 },
          0.35,
        )
        .to(
          ".gpr-home .hero h1 .line-3",
          { yPercent: 0, duration: 1.1, stagger: 0.06 },
          0.5,
        )
        .from(
          ".gpr-home .hero .label",
          { y: 16, opacity: 0, duration: 0.8 },
          0.1,
        )
        .from(
          ".gpr-home .hero-sub p, .gpr-home .hero-sub .cta-row",
          { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 },
          0.7,
        )
        .from(
          ".gpr-home .float-num",
          { opacity: 0, scale: 0.8, duration: 1.2, stagger: 0.1 },
          0.4,
        )
        .from(
          ".gpr-home .hero-card",
          { y: 60, opacity: 0, rotation: 8, duration: 1.2 },
          0.6,
        );

      // ─── Hero card parallax tilt + scroll drift ───
      const heroCard =
        root.current?.querySelector<HTMLElement>(".hero-card");
      const onMouseMove = (e: MouseEvent) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        if (heroCard) {
          gsap.to(heroCard, {
            rotationY: dx * 12,
            rotationX: -dy * 8,
            x: dx * 14,
            duration: 1,
            ease: "power3.out",
          });
        }
      };
      window.addEventListener("mousemove", onMouseMove);

      gsap.to(".gpr-home .hero-card", {
        y: -60,
        scrollTrigger: {
          trigger: ".gpr-home .hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      gsap.to(".gpr-home .float-num.a", {
        y: -120,
        scrollTrigger: {
          trigger: ".gpr-home .hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.2,
        },
      });
      gsap.to(".gpr-home .float-num.b", {
        y: -200,
        scrollTrigger: {
          trigger: ".gpr-home .hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.4,
        },
      });
      gsap.to(".gpr-home .float-num.c", {
        y: -160,
        scrollTrigger: {
          trigger: ".gpr-home .hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.1,
        },
      });

      // Subtle hero card flip every few seconds.
      gsap
        .timeline({ repeat: -1, repeatDelay: 4 })
        .to(".gpr-home .hero-card", {
          rotationZ: 2,
          duration: 0.4,
          ease: "power2.inOut",
        })
        .to(".gpr-home .hero-card", {
          rotationZ: -1,
          duration: 0.5,
          ease: "power2.inOut",
        })
        .to(".gpr-home .hero-card", {
          rotationZ: 0,
          duration: 0.4,
          ease: "power2.inOut",
        });

      // ─── Marquee ───
      const track = root.current?.querySelector<HTMLElement>(
        ".gpr-home .marquee-track",
      );
      if (track) {
        const trackWidth = track.scrollWidth / 2;
        gsap.to(track, {
          x: -trackWidth,
          duration: 40,
          ease: "none",
          repeat: -1,
        });
      }

      // ─── Reveal text — wraps content in an inner span and slides it up ───
      root.current
        ?.querySelectorAll<HTMLElement>(".gpr-home .reveal-text")
        .forEach((el) => {
          if (!el.querySelector(".rl-inner")) {
            const html = el.innerHTML;
            el.innerHTML = `<span class="rl-inner" style="display:inline-block;">${html}</span>`;
          }
          gsap.from(el.querySelector(".rl-inner"), {
            yPercent: 60,
            opacity: 0,
            duration: 1.1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
          });
        });

      // ─── Generic reveal ───
      gsap.utils
        .toArray<HTMLElement>(".gpr-home .reveal")
        .forEach((el) => {
          gsap.from(el, {
            y: 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          });
        });

      // ─── Problem Xs draw in ───
      gsap.utils
        .toArray<HTMLElement>(".gpr-home .prob-card")
        .forEach((card, i) => {
          const x = card.querySelector(".x");
          if (!x) return;
          gsap.from(x, {
            rotation: -180,
            scale: 0,
            opacity: 0,
            duration: 0.9,
            ease: "back.out(1.6)",
            delay: i * 0.08,
            scrollTrigger: { trigger: card, start: "top 80%" },
          });
        });

      // ─── Cards section: parallax dealt cards ───
      gsap.from(".gpr-home .ref-card.y", {
        y: 100,
        rotation: -10,
        opacity: 0,
        duration: 1,
        scrollTrigger: {
          trigger: ".gpr-home .cards-section",
          start: "top 60%",
        },
      });
      gsap.from(".gpr-home .ref-card.r", {
        y: 140,
        rotation: 6,
        opacity: 0,
        duration: 1,
        delay: 0.1,
        scrollTrigger: {
          trigger: ".gpr-home .cards-section",
          start: "top 60%",
        },
      });
      gsap.from(".gpr-home .ref-card.mvp", {
        y: 100,
        rotation: -3,
        opacity: 0,
        duration: 1,
        delay: 0.2,
        scrollTrigger: {
          trigger: ".gpr-home .cards-section",
          start: "top 60%",
        },
      });

      // Card hover tilt.
      const cardTiltHandlers: Array<{
        el: HTMLElement;
        move: (e: MouseEvent) => void;
        leave: () => void;
      }> = [];
      root.current
        ?.querySelectorAll<HTMLElement>(".gpr-home .ref-card")
        .forEach((card) => {
          const move = (e: MouseEvent) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            gsap.to(card, {
              rotationY: x * 18,
              rotationX: -y * 14,
              duration: 0.5,
              ease: "power3.out",
              transformPerspective: 1000,
            });
          };
          const leave = () =>
            gsap.to(card, {
              rotationY: 0,
              rotationX: 0,
              duration: 0.6,
              ease: "power3.out",
            });
          card.addEventListener("mousemove", move);
          card.addEventListener("mouseleave", leave);
          cardTiltHandlers.push({ el: card, move, leave });
        });

      // ─── Match report mock — rows reveal + score count up ───
      gsap.utils
        .toArray<HTMLElement>(".gpr-home #mockRows .row")
        .forEach((row, i) => {
          gsap.from(row, {
            x: -20,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.05,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".gpr-home #matchMock",
              start: "top 70%",
            },
          });
          const score = row.querySelector<HTMLElement>(".score");
          if (!score) return;
          const target = parseInt(score.textContent ?? "0", 10);
          const obj = { v: 0 };
          ScrollTrigger.create({
            trigger: ".gpr-home #matchMock",
            start: "top 70%",
            onEnter: () => {
              gsap.to(obj, {
                v: target,
                duration: 1.2,
                delay: i * 0.05 + 0.2,
                ease: "power2.out",
                onUpdate: () => {
                  score.textContent = String(Math.round(obj.v)).padStart(
                    target >= 10 ? 2 : 1,
                    "0",
                  );
                },
              });
            },
          });
        });

      gsap.to(".gpr-home #matchMock", {
        y: -40,
        scrollTrigger: {
          trigger: ".gpr-home #matchMock",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      // ─── Big quote bg parallax ───
      gsap.to(".gpr-home .quote-bg", {
        x: -120,
        scrollTrigger: {
          trigger: ".gpr-home .quote-section",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      // ─── Capability cards stagger ───
      gsap.utils
        .toArray<HTMLElement>(".gpr-home .cap")
        .forEach((cap, i) => {
          gsap.from(cap, {
            y: 50,
            opacity: 0,
            duration: 0.8,
            delay: (i % 3) * 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".gpr-home .caps-grid",
              start: "top 75%",
            },
          });
        });

      // Wave inside the wide cap.
      const wavePath =
        root.current?.querySelector<SVGPathElement>("#wavePath");
      if (wavePath) {
        gsap.to(wavePath, {
          attr: {
            d: "M0,80 Q30,110 60,70 T120,90 T180,60 T240,100 T300,70",
          },
          duration: 4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }

      // ─── Final CTA reveal ───
      gsap.set(".gpr-home .final h2 .line-final", { yPercent: 110 });
      ScrollTrigger.create({
        trigger: ".gpr-home .final",
        start: "top 70%",
        onEnter: () => {
          gsap.to(".gpr-home .final h2 .line-final", {
            yPercent: 0,
            duration: 1.1,
            stagger: 0.08,
            ease: "expo.out",
          });
          gsap.from(".gpr-home .final p, .gpr-home .final .cta-row", {
            y: 20,
            opacity: 0,
            duration: 0.8,
            stagger: 0.08,
            delay: 0.3,
          });
        },
      });

      // ─── Magnetic buttons ───
      const magneticHandlers: Array<{
        el: HTMLElement;
        move: (e: MouseEvent) => void;
        leave: () => void;
      }> = [];
      root.current
        ?.querySelectorAll<HTMLElement>(".gpr-home .magnetic")
        .forEach((btn) => {
          const move = (e: MouseEvent) => {
            const r = btn.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            gsap.to(btn, {
              x: x * 0.3,
              y: y * 0.3,
              duration: 0.4,
              ease: "power3.out",
            });
          };
          const leave = () =>
            gsap.to(btn, {
              x: 0,
              y: 0,
              duration: 0.5,
              ease: "elastic.out(1, 0.5)",
            });
          btn.addEventListener("mousemove", move);
          btn.addEventListener("mouseleave", leave);
          magneticHandlers.push({ el: btn, move, leave });
        });

      // ─── Cursor follower ───
      const dot = root.current?.querySelector<HTMLElement>(".cursor-dot");
      const ring = root.current?.querySelector<HTMLElement>(".cursor-ring");
      let mx = 0;
      let my = 0;
      let rx = 0;
      let ry = 0;
      const cursorMove = (e: MouseEvent) => {
        mx = e.clientX;
        my = e.clientY;
        if (dot) {
          gsap.to(dot, {
            x: mx,
            y: my,
            duration: 0.05,
            overwrite: "auto",
          });
        }
      };
      const tick = () => {
        rx += (mx - rx) * 0.15;
        ry += (my - ry) * 0.15;
        if (ring) gsap.set(ring, { x: rx, y: ry });
      };
      window.addEventListener("mousemove", cursorMove);
      gsap.ticker.add(tick);

      const hoverEls = root.current?.querySelectorAll<HTMLElement>(
        ".gpr-home a, .gpr-home button, .gpr-home .magnetic, .gpr-home .ref-card, .gpr-home .prob-card, .gpr-home .cap, .gpr-home .row",
      );
      const hoverHandlers: Array<{
        el: HTMLElement;
        enter: () => void;
        leave: () => void;
      }> = [];
      hoverEls?.forEach((el) => {
        const enter = () => {
          if (ring) {
            gsap.to(ring, {
              scale: 1.6,
              borderColor: "var(--gpr-red)",
              duration: 0.25,
            });
          }
        };
        const leave = () => {
          if (ring) {
            gsap.to(ring, {
              scale: 1,
              borderColor: "var(--gpr-ink)",
              duration: 0.25,
            });
          }
        };
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
        hoverHandlers.push({ el, enter, leave });
      });

      // ─── Smooth scroll for anchor links ───
      const anchorHandlers: Array<{
        el: HTMLElement;
        click: (e: MouseEvent) => void;
      }> = [];
      root.current
        ?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
        .forEach((a) => {
          const click = (e: MouseEvent) => {
            const id = a.getAttribute("href");
            if (id && id.length > 1 && document.querySelector(id)) {
              e.preventDefault();
              const target = document.querySelector(id) as HTMLElement;
              const top =
                target.getBoundingClientRect().top + window.scrollY - 20;
              window.scrollTo({ top, behavior: "smooth" });
            }
          };
          a.addEventListener("click", click);
          anchorHandlers.push({ el: a, click });
        });

      ScrollTrigger.refresh();

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mousemove", cursorMove);
        gsap.ticker.remove(tick);
        cardTiltHandlers.forEach(({ el, move, leave }) => {
          el.removeEventListener("mousemove", move);
          el.removeEventListener("mouseleave", leave);
        });
        magneticHandlers.forEach(({ el, move, leave }) => {
          el.removeEventListener("mousemove", move);
          el.removeEventListener("mouseleave", leave);
        });
        hoverHandlers.forEach(({ el, enter, leave }) => {
          el.removeEventListener("mouseenter", enter);
          el.removeEventListener("mouseleave", leave);
        });
        anchorHandlers.forEach(({ el, click }) => {
          el.removeEventListener("click", click);
        });
      };
    }, root);

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

  return (
    <main ref={root} className="gpr-home">
      <GprHomeStyles />

      <div className="cursor-dot" aria-hidden />
      <div className="cursor-ring" aria-hidden />

      <nav className="top">
        <Link className="word-mark" href="/">
          <span>GPR</span>
          <span className="dot" />
        </Link>
        <div
          style={{ display: "flex", gap: 28, alignItems: "center" }}
          className="top-links"
        >
          <Link className="lk" href="#problem">
            The problem
          </Link>
          <Link className="lk" href="#how">
            How
          </Link>
          <Link className="lk" href="#caps">
            Capabilities
          </Link>
          <Link className="lk" href="/docs">
            Docs
          </Link>
          <Link className="lk" href="/changelog">
            Changelog
          </Link>
          <Link className="lk pill" href={ctaHref}>
            {ctaLabel}
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="float-num a num">46</div>
        <div className="float-num b num">08</div>
        <div className="float-num c num">93</div>

        <div className="hero-card" id="heroCard">
          <div className="lbl">Red card · 09</div>
          <div className="nm">Casey</div>
          <div className="meta">Content · MIA</div>
          <div className="big num">12</div>
        </div>

        <div className="hero-grid">
          <div className="label" style={{ marginBottom: 24 }}>
            ▣ An accountability layer for group projects
          </div>
          <h1>
            <span className="word">
              <span className="line line-1">The </span>
            </span>
            <span className="word">
              <span className="line line-1 ref-word">ref&nbsp;</span>
            </span>
            <span className="word">
              <span className="line line-1">your</span>
            </span>
            <br />
            <span className="word">
              <span className="line line-2">group</span>
            </span>{" "}
            <span className="word">
              <span className="line line-2">project</span>
            </span>
            <br />
            <span className="word">
              <span className="line line-3">never</span>
            </span>{" "}
            <span className="word">
              <span className="line line-3">had.</span>
            </span>
          </h1>
          <div className="hero-sub">
            <p>
              GPR reads your meeting transcripts, watches your tickets, and
              scores your team automatically. No bias. No politics. No
              excuses.
            </p>
            <div className="cta-row">
              <Link className="pill magnetic" href={ctaHref}>
                {ctaLabel}
              </Link>
              <Link className="pill ghost magnetic" href="#how">
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MARQUEE SCOREBOARD ─── */}
      <div className="marquee">
        <div className="marquee-track">
          {Array.from({ length: 2 }).flatMap((_, copy) =>
            MARQUEE.map((m, i) => (
              <span className="marquee-item" key={`${copy}-${i}`}>
                {m.name} <span className="pts num">{m.pts} pts</span>
                {m.flag && <span className={`flag ${m.flag}`} />}
              </span>
            )),
          )}
        </div>
      </div>

      {/* ─── PROBLEM ─── */}
      <section className="problem" id="problem">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="num-tag num">01</span>
            <span className="lbl">The problem</span>
            <span className="line" />
          </div>
          <h2 className="reveal-text">
            You already know who&rsquo;s not pulling their weight.{" "}
            <em>You just can&rsquo;t prove it.</em>
          </h2>
          <div className="prob-grid">
            <div className="prob-card reveal">
              <div className="x" />
              <div>
                <div className="role">The ghost</div>
                <div className="quote">
                  You wrote the report. They put their name on it.
                </div>
              </div>
            </div>
            <div className="prob-card reveal">
              <div className="x" />
              <div>
                <div className="role">The procrastinator</div>
                <div className="quote">
                  The meeting had action items. Nobody did them.
                </div>
              </div>
            </div>
            <div className="prob-card reveal">
              <div className="x" />
              <div>
                <div className="role">The scapegoat</div>
                <div className="quote">
                  The deadline passed. Someone blamed the tools.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="how" id="how">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="num-tag num">02</span>
            <span className="lbl">How it works</span>
            <span className="line" />
          </div>
          <h2
            style={{
              fontSize: "clamp(36px, 5vw, 72px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              margin: "0 0 80px",
              maxWidth: 900,
            }}
          >
            You run the project. The ref runs the receipts.
          </h2>
          <div className="how-grid">
            <div className="how-card reveal">
              <div className="n num">01 / Set up</div>
              <h3>Connect your project</h3>
              <p>
                Create a project, invite your team, link your GitHub repo.
                GPR starts watching from day one.
              </p>
            </div>
            <div className="how-card reveal">
              <div className="n num">02 / Ingest</div>
              <h3>Run your meeting normally</h3>
              <p>
                After any meeting, paste the transcript. Voice notes, Zoom
                exports, copied Slack threads — GPR reads it all.
              </p>
            </div>
            <div className="how-card reveal">
              <div className="n num">03 / Verdict</div>
              <h3>The ref calls it</h3>
              <p>
                GPR extracts every commitment, scores every member, and
                issues cards automatically. Yellow for falling behind. Red
                for going dark. MVP for carrying the squad.
              </p>
            </div>
            <div className="how-card reveal">
              <div className="n num">04 / Memory</div>
              <h3>Evidence builds over time</h3>
              <p>
                Every meeting adds to your project knowledge base. Ask GPR
                anything — who committed to what, what was decided,
                who&rsquo;s been quiet for a week.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CARDS ─── */}
      <section className="cards-section" id="cards">
        <div className="wrap">
          <div
            className="section-eyebrow"
            style={{ marginBottom: 56 }}
          >
            <span
              className="num-tag num"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              03
            </span>
            <span
              className="lbl"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              The rulebook
            </span>
            <span
              className="line"
              style={{ background: "rgba(255,255,255,0.15)" }}
            />
          </div>
          <h2 className="reveal-text">
            Three calls. <span className="mute2">One rulebook.</span>
          </h2>
          <div className="cards-stage">
            <div className="col y">
              <div className="ref-card y reveal-card" />
              <h3>Yellow card</h3>
              <div className="sub">Falling behind</div>
              <p>
                Vague commitments. Tickets going stale. The ref books you,
                and the team sees it.
              </p>
            </div>
            <div className="col r">
              <div className="ref-card r reveal-card" />
              <h3>Red card</h3>
              <div className="sub">No contact</div>
              <p>
                No-shows, missed deadlines without notice, deliverables
                ghosted for days.
              </p>
            </div>
            <div className="col mvp">
              <div className="ref-card mvp reveal-card">
                <span className="star">★</span>
              </div>
              <h3>MVP</h3>
              <div className="sub">Top contributor</div>
              <p>
                Quietly carrying the project. The ref keeps receipts so you
                don&rsquo;t have to defend yourself in retro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── RECEIPTS / MATCH REPORT MOCK ─── */}
      <section className="receipts">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="num-tag num">04</span>
            <span className="lbl">A real match report</span>
            <span className="line" />
          </div>
          <h2 className="reveal-text">
            Receipts. <em>With timestamps.</em>
          </h2>
          <div className="mock" id="matchMock">
            <div className="mock-head">
              <div className="tabs">
                <span>Sam 71</span>
                <span>Alex 45</span>
                <span>Priya 82</span>
                <span className="on">Casey 12</span>
                <span>Riley 67</span>
                <span>Morgan 55</span>
                <span>Jordan 94</span>
              </div>
              <div className="tag-final">Final</div>
            </div>
            <div className="mock-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gpr-mute)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Sprint 04 · Meeting recap
                  </div>
                  <h3>Project Falcon</h3>
                </div>
              </div>
              <p className="desc">
                Two members carried the load. One has not delivered in
                eleven days. Detailed verdict and commitments below.
              </p>
              <div className="mock-rows" id="mockRows">
                {ROSTER.map((r, i) => (
                  <div className="row" key={r.name}>
                    <span className="rk num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="nm">
                      <span className="n">{r.name}</span>
                      <span className="role">{r.role}</span>
                    </span>
                    {r.flag ? (
                      <span className={`flag ${r.flag}`} />
                    ) : (
                      <span />
                    )}
                    <span
                      className={`score num${r.flag === "r" ? " r" : ""}`}
                    >
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mock-foot">
              <div
                style={{
                  fontSize: 11,
                  color: "var(--gpr-mute)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Open commitments
              </div>
              <div className="ln">
                <span className="nm">Jordan</span>{" "}
                <span className="strike">
                  — Finalize the API contract by Thursday EOD.
                </span>{" "}
                <span className="ago">Thu</span>
              </div>
              <div className="ln">
                ● <span className="nm">Maya</span> — Migrate auth middleware
                before next stand-up. <span className="ago">Mon</span>
              </div>
              <div className="ln">
                ● <span className="nm">Sam</span> — Send the stakeholder
                update with sprint metrics.{" "}
                <span className="ago r">2 days ago</span>
              </div>
              <div className="ln">
                ● <span className="nm">Casey</span> — Reply to anything in
                the channel. <span className="ago r">11 days ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BIG QUOTE ─── */}
      <section className="quote-section">
        <div className="quote-bg num">19</div>
        <div className="wrap">
          <div className="label">Sample digest, week 19</div>
          <blockquote className="reveal-text">
            &ldquo;The work was not evenly shared. Two members carried the
            load.{" "}
            <span className="em">
              One has not delivered in eleven days.
            </span>{" "}
            The team agreed on a contract; the contract was not honored.
            &rdquo;
          </blockquote>
          <div className="cite">
            — GPR Weekly Digest · Confidential · Do not forward
          </div>
        </div>
      </section>

      {/* ─── CAPABILITIES ─── */}
      <section className="caps" id="caps">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="num-tag num">05</span>
            <span className="lbl">Capabilities</span>
            <span className="line" />
          </div>
          <h2 className="reveal-text">Everything a good ref needs.</h2>
          <div className="caps-grid">
            <div className="cap wide">
              <h3>Meeting analysis</h3>
              <p>
                Reads transcripts so you do not have to. Pulls every
                commitment, every silence, every excuse.
              </p>
              <svg
                className="viz-wave"
                viewBox="0 0 300 140"
                preserveAspectRatio="none"
              >
                <path
                  id="wavePath"
                  d="M0,80 Q30,40 60,80 T120,80 T180,80 T240,80 T300,80"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.5"
                />
              </svg>
              <div className="ix">01</div>
            </div>
            <div className="cap tall">
              <h3>Knowledge base</h3>
              <p>
                Remembers everything so nobody can say they forgot.
                Searchable across every meeting, ticket, and message.
              </p>
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  left: 28,
                  right: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    height: 2,
                    background: "var(--gpr-line)",
                    width: "90%",
                  }}
                />
                <div
                  style={{
                    height: 2,
                    background: "var(--gpr-line)",
                    width: "70%",
                  }}
                />
                <div
                  style={{
                    height: 2,
                    background: "var(--gpr-line)",
                    width: "85%",
                  }}
                />
                <div
                  style={{
                    height: 2,
                    background: "var(--gpr-red)",
                    width: "40%",
                  }}
                />
              </div>
              <div className="ix">02</div>
            </div>
            <div className="cap">
              <h3>Leaderboard</h3>
              <p>
                Who is carrying the squad. Updated after every meeting.
              </p>
              <div className="ix">03</div>
            </div>
            <div className="cap red-cap">
              <h3>Ask GPR anything</h3>
              <p>It only knows what your team has done.</p>
              <div className="ix" style={{ color: "rgba(255,255,255,0.7)" }}>
                04
              </div>
            </div>
            <div className="cap">
              <h3>GitHub integration</h3>
              <p>Commits don&rsquo;t lie. Neither does GPR.</p>
              <div className="ix">05</div>
            </div>
            <div className="cap">
              <h3>Multi-source</h3>
              <p>
                Transcripts, GitHub, Jira, Slack. Every angle covered.
              </p>
              <div className="ix">06</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FIELD REPORTS / TESTIMONIALS ─── */}
      <section style={{ padding: "120px 40px" }}>
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="num-tag num">06</span>
            <span className="lbl">Field reports</span>
            <span className="line" />
          </div>
          <h2
            className="reveal-text"
            style={{
              fontSize: "clamp(40px, 6vw, 88px)",
              margin: "0 0 80px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
            }}
          >
            The ref keeps receipts.{" "}
            <span className="mute">People notice.</span>
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
            }}
            className="field-grid"
          >
            <div
              className="reveal"
              style={{
                background: "#fff",
                border: "1px solid var(--gpr-line)",
                padding: 32,
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                }}
              >
                &ldquo;I used to be the one doing everything. Now I have
                proof.&rdquo;
              </p>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Final-year CS student
                </div>
                <div style={{ fontSize: 12, color: "var(--gpr-mute)" }}>
                  University of Canterbury
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                background: "#fff",
                border: "1px solid var(--gpr-line)",
                padding: 32,
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                }}
              >
                &ldquo;Our group project went from chaos to accountability
                in one meeting.&rdquo;
              </p>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Product team
                </div>
                <div style={{ fontSize: 12, color: "var(--gpr-mute)" }}>
                  Early-stage startup
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                background: "var(--gpr-ink)",
                color: "#fff",
                border: "1px solid var(--gpr-ink)",
                padding: 32,
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                }}
              >
                &ldquo;The red card on my teammate was the most satisfying
                thing I have ever seen.&rdquo;
              </p>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Anonymous</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  …but we know who
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="final">
        <div className="wrap">
          <h2>
            <span className="word">
              <span className="line line-final">Stop being the one</span>
            </span>
            <br />
            <span className="word">
              <span className="line line-final">who does</span>
            </span>
            <br />
            <span className="word">
              <span className="line line-final ref-word">everything.</span>
            </span>
          </h2>
          <p>Let GPR keep the receipts.</p>
          <div className="cta-row">
            <Link className="pill magnetic" href={ctaHref}>
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <Link className="word-mark" href="/">
          <span>GPR</span>
          <span className="dot" />
        </Link>
        <div>© {new Date().getFullYear()} GPR — Group Project Referee</div>
        <div>
          Built with meraki — Lincoln University, Christchurch NZ
        </div>
      </footer>
    </main>
  );
}

const MARQUEE: Array<{
  name: string;
  pts: number;
  flag?: "y" | "r" | "mvp";
}> = [
  { name: "Casey", pts: 12, flag: "r" },
  { name: "Riley", pts: 67, flag: "y" },
  { name: "Morgan", pts: 55 },
  { name: "Jordan", pts: 94, flag: "mvp" },
  { name: "Maya", pts: 88 },
  { name: "Sam", pts: 71, flag: "y" },
  { name: "Alex", pts: 45, flag: "r" },
  { name: "Priya", pts: 82 },
];

const ROSTER: Array<{
  name: string;
  role: string;
  score: number;
  flag?: "y" | "r" | "mvp";
}> = [
  { name: "Jordan", role: "backend", score: 94, flag: "mvp" },
  { name: "Maya", role: "frontend", score: 88 },
  { name: "Priya", role: "design", score: 82 },
  { name: "Sam", role: "qa", score: 71, flag: "y" },
  { name: "Riley", role: "ops", score: 67, flag: "y" },
  { name: "Morgan", role: "research", score: 55 },
  { name: "Alex", role: "pm", score: 45, flag: "r" },
  { name: "Casey", role: "content", score: 12, flag: "r" },
];

// All landing styles scoped under .gpr-home so they can never bleed
// into the dashboard or any other route.
function GprHomeStyles() {
  return (
    <style>{`
      .gpr-home {
        --gpr-bg: #fafaf7;
        --gpr-ink: #0a0a0a;
        --gpr-ink-2: #1c1c1a;
        --gpr-mute: #8a8a85;
        --gpr-mute-2: #b8b8b3;
        --gpr-line: #e5e3dc;
        --gpr-red: #e10600;
        --gpr-paper: #ffffff;
        --gpr-yellow: #f5c518;
        --gpr-green: #1c8c4d;
        --gpr-gold: #b78628;
        background: var(--gpr-bg);
        color: var(--gpr-ink);
        font-size: 15px;
        line-height: 1.55;
        overflow-x: hidden;
        min-height: 100vh;
      }
      .gpr-home, .gpr-home * { box-sizing: border-box; }
      .gpr-home a, .gpr-home button {
        font-family: inherit;
        cursor: pointer;
        background: none;
        border: none;
        color: inherit;
        padding: 0;
        text-decoration: none;
      }
      .gpr-home ::selection { background: var(--gpr-red); color: #fff; }

      .gpr-home .display { font-weight: 500; letter-spacing: -0.035em; line-height: 0.94; font-variation-settings: "wdth" 90, "opsz" 96; }
      .gpr-home .num { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
      .gpr-home .label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gpr-mute); font-weight: 500; }
      .gpr-home .hr { height: 1px; background: var(--gpr-line); border: 0; margin: 0; }
      .gpr-home .wrap { max-width: 1280px; margin: 0 auto; padding: 0 40px; }
      .gpr-home .red { color: var(--gpr-red); }
      .gpr-home .mute { color: var(--gpr-mute); }

      /* ─── Top nav ─── */
      .gpr-home nav.top {
        position: fixed; top: 0; left: 0; right: 0; z-index: 50;
        padding: 22px 40px;
        display: flex; align-items: center; justify-content: space-between;
        mix-blend-mode: difference; color: #fff;
      }
      .gpr-home nav.top .lk { font-size: 13px; color: rgba(255,255,255,0.85); }
      .gpr-home nav.top .lk:hover { color: #fff; }
      .gpr-home nav.top .pill {
        background: #fff; color: var(--gpr-ink);
        padding: 9px 16px; border-radius: 999px;
        font-size: 13px; font-weight: 500; mix-blend-mode: difference;
      }
      .gpr-home .word-mark {
        display: inline-flex; align-items: baseline; gap: 5px;
        font-weight: 600; font-size: 18px; letter-spacing: -0.02em;
      }
      .gpr-home .word-mark span.dot {
        width: 4px; height: 4px;
        background: var(--gpr-red); margin-bottom: 3px;
        mix-blend-mode: normal;
      }

      /* ─── Hero ─── */
      .gpr-home .hero {
        padding: 140px 40px 80px;
        position: relative; min-height: 100vh;
        display: flex; flex-direction: column; justify-content: center;
      }
      .gpr-home .hero-grid { max-width: 1280px; margin: 0 auto; width: 100%; position: relative; }
      .gpr-home .hero h1 {
        font-size: clamp(64px, 11.5vw, 196px);
        margin: 0; font-weight: 500; letter-spacing: -0.045em; line-height: 0.86;
      }
      .gpr-home .hero h1 .ref-word, .gpr-home .ref-word { color: var(--gpr-red); display: inline-block; }
      .gpr-home .hero h1 .word { display: inline-block; overflow: hidden; vertical-align: top; }
      .gpr-home .hero h1 .word > span { display: inline-block; }
      .gpr-home .hero-sub { display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; align-items: end; margin-top: 64px; }
      .gpr-home .hero-sub p { margin: 0; font-size: 18px; max-width: 460px; line-height: 1.5; color: var(--gpr-ink-2); font-weight: 350; }

      .gpr-home .float-num {
        position: absolute; font-weight: 500;
        color: rgba(225,6,0,0.08);
        font-size: clamp(80px, 14vw, 220px);
        letter-spacing: -0.05em; line-height: 0.85;
        pointer-events: none; user-select: none;
      }
      .gpr-home .float-num.a { top: 60px; right: 280px; }
      .gpr-home .float-num.b { top: 220px; right: 120px; }
      .gpr-home .float-num.c { bottom: 80px; right: 0; }

      .gpr-home .hero-card {
        position: absolute; top: 100px; right: 80px;
        width: 130px; height: 180px;
        background: var(--gpr-red); color: #fff;
        padding: 16px;
        box-shadow: 0 30px 60px rgba(225,6,0,0.35), 0 1px 0 rgba(0,0,0,0.04);
        will-change: transform;
      }
      .gpr-home .hero-card .lbl { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
      .gpr-home .hero-card .nm { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; margin-top: 6px; }
      .gpr-home .hero-card .meta { font-size: 9px; opacity: 0.75; margin-top: 2px; letter-spacing: 0.08em; text-transform: uppercase; }
      .gpr-home .hero-card .big {
        position: absolute; bottom: 14px; left: 16px;
        font-size: 56px; font-weight: 500; letter-spacing: -0.04em;
      }

      .gpr-home .cta-row { display: flex; gap: 12px; margin-top: 36px; align-items: center; flex-wrap: wrap; }
      .gpr-home .pill {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 14px 22px; border-radius: 999px;
        background: var(--gpr-red); color: #fff;
        font-size: 15px; font-weight: 500;
        transition: transform 0.15s, background 0.15s;
        will-change: transform;
      }
      .gpr-home .pill:hover { background: #b00400; }
      .gpr-home .pill.ghost { background: transparent; color: var(--gpr-ink); border: 1px solid var(--gpr-ink); }
      .gpr-home .pill.ghost:hover { background: var(--gpr-ink); color: #fff; }

      /* ─── Marquee scoreboard ─── */
      .gpr-home .marquee {
        padding: 22px 0;
        border-top: 1px solid var(--gpr-line);
        border-bottom: 1px solid var(--gpr-line);
        overflow: hidden; white-space: nowrap;
        background: var(--gpr-bg);
      }
      .gpr-home .marquee-track { display: inline-flex; gap: 56px; padding-right: 56px; }
      .gpr-home .marquee-item { display: inline-flex; align-items: center; gap: 14px; font-size: 16px; font-weight: 500; }
      .gpr-home .marquee-item .pts { color: var(--gpr-mute); font-size: 14px; }
      .gpr-home .marquee-item .flag { width: 14px; height: 18px; display: inline-block; }
      .gpr-home .marquee-item .flag.y { background: var(--gpr-yellow); }
      .gpr-home .marquee-item .flag.r { background: var(--gpr-red); }
      .gpr-home .marquee-item .flag.mvp { background: var(--gpr-ink); position: relative; }
      .gpr-home .marquee-item .flag.mvp::after {
        content: '★'; color: #fff;
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px;
      }

      /* ─── Section base ─── */
      .gpr-home section { position: relative; }
      .gpr-home .section-eyebrow { display: flex; align-items: center; gap: 12px; margin-bottom: 56px; }
      .gpr-home .section-eyebrow .num-tag { font-size: 11px; color: var(--gpr-mute); }
      .gpr-home .section-eyebrow .lbl { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gpr-mute); }
      .gpr-home .section-eyebrow .line { flex: 1; height: 1px; background: var(--gpr-line); }

      /* ─── Problem ─── */
      .gpr-home .problem { padding: 140px 40px; }
      .gpr-home .problem h2 {
        font-size: clamp(40px, 6vw, 88px);
        margin: 0 0 80px; font-weight: 500; letter-spacing: -0.035em; line-height: 0.95;
        max-width: 1000px;
      }
      .gpr-home .problem h2 em { font-style: normal; color: var(--gpr-red); }
      .gpr-home .prob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
      .gpr-home .prob-card {
        background: #fff; padding: 32px;
        min-height: 260px;
        display: flex; flex-direction: column; justify-content: space-between;
        border: 1px solid var(--gpr-line);
        position: relative; overflow: hidden;
      }
      .gpr-home .prob-card .x { width: 36px; height: 36px; position: relative; }
      .gpr-home .prob-card .x::before, .gpr-home .prob-card .x::after {
        content: ''; position: absolute; top: 50%; left: 50%;
        width: 36px; height: 2px; background: var(--gpr-red);
        transform-origin: center;
      }
      .gpr-home .prob-card .x::before { transform: translate(-50%, -50%) rotate(45deg); }
      .gpr-home .prob-card .x::after { transform: translate(-50%, -50%) rotate(-45deg); }
      .gpr-home .prob-card .role { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gpr-mute); margin-bottom: 8px; }
      .gpr-home .prob-card .quote { font-size: 22px; font-weight: 500; letter-spacing: -0.018em; line-height: 1.2; }

      /* ─── How it works ─── */
      .gpr-home .how { padding: 140px 40px; background: var(--gpr-bg); }
      .gpr-home .how-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; align-items: start; }
      .gpr-home .how-card .n { font-size: 14px; font-weight: 500; color: var(--gpr-red); margin-bottom: 22px; }
      .gpr-home .how-card h3 { font-size: 22px; font-weight: 500; letter-spacing: -0.018em; line-height: 1.15; margin: 0 0 12px; }
      .gpr-home .how-card p { font-size: 14px; line-height: 1.55; color: var(--gpr-mute); margin: 0; }

      /* ─── Cards section ─── */
      .gpr-home .cards-section {
        padding: 160px 40px;
        background: var(--gpr-ink); color: #fff;
        position: relative; overflow: hidden;
      }
      .gpr-home .cards-section h2 {
        font-size: clamp(40px, 6.5vw, 96px);
        margin: 0 0 96px; font-weight: 500; letter-spacing: -0.035em; line-height: 0.95;
        max-width: 1000px;
      }
      .gpr-home .cards-section h2 .mute2 { color: rgba(255,255,255,0.35); }
      .gpr-home .cards-stage { display: grid; grid-template-columns: repeat(3, 1fr); gap: 56px; align-items: end; }
      .gpr-home .ref-card {
        width: 100%; aspect-ratio: 5/7; max-width: 240px;
        position: relative;
        box-shadow: 0 30px 80px rgba(0,0,0,0.4);
        will-change: transform;
      }
      .gpr-home .ref-card.y { background: var(--gpr-yellow); }
      .gpr-home .ref-card.r { background: var(--gpr-red); }
      .gpr-home .ref-card.mvp { background: #fff; color: var(--gpr-ink); border: 1px solid #fff; }
      .gpr-home .ref-card .star {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 64px; color: var(--gpr-ink);
      }
      .gpr-home .cards-stage h3 { font-size: 26px; font-weight: 500; letter-spacing: -0.018em; margin: 32px 0 6px; }
      .gpr-home .cards-stage .sub { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 14px; }
      .gpr-home .cards-stage p { font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.5); margin: 0; }
      .gpr-home .cards-stage .col.y .sub { color: var(--gpr-yellow); }
      .gpr-home .cards-stage .col.r .sub { color: var(--gpr-red); }
      .gpr-home .cards-stage .col.mvp .sub { color: var(--gpr-gold); }

      /* ─── Receipts mockup ─── */
      .gpr-home .receipts { padding: 160px 40px; }
      .gpr-home .receipts h2 {
        font-size: clamp(40px, 6vw, 88px);
        margin: 0 0 56px; font-weight: 500; letter-spacing: -0.035em; line-height: 0.95;
      }
      .gpr-home .receipts h2 em { font-style: normal; color: var(--gpr-red); }
      .gpr-home .mock {
        background: #fff; border: 1px solid var(--gpr-line);
        max-width: 900px; margin: 0 auto;
        box-shadow: 0 60px 120px -40px rgba(10,10,10,0.18);
        will-change: transform;
      }
      .gpr-home .mock-head {
        display: flex; align-items: center; gap: 0;
        border-bottom: 1px solid var(--gpr-line);
        padding: 14px 22px;
        font-size: 11px; color: var(--gpr-mute);
        justify-content: space-between;
      }
      .gpr-home .mock-head .tabs { display: flex; gap: 18px; }
      .gpr-home .mock-head .tabs span { padding: 4px 0; font-size: 11px; letter-spacing: 0.04em; }
      .gpr-home .mock-head .tabs .on { color: var(--gpr-ink); border-bottom: 1px solid var(--gpr-ink); }
      .gpr-home .mock-head .tag-final { color: var(--gpr-red); font-weight: 500; letter-spacing: 0.06em; }
      .gpr-home .mock-body { padding: 28px 32px 8px; }
      .gpr-home .mock-body h3 { font-size: 26px; font-weight: 500; letter-spacing: -0.02em; margin: 0; }
      .gpr-home .mock-body .desc { font-size: 13px; color: var(--gpr-mute); margin: 6px 0 24px; }
      .gpr-home .mock-rows .row {
        display: grid; grid-template-columns: 50px 1fr 70px 70px;
        gap: 24px; padding: 14px 0;
        border-top: 1px solid var(--gpr-line);
        align-items: center;
      }
      .gpr-home .mock-rows .row .rk { font-size: 13px; color: var(--gpr-mute); }
      .gpr-home .mock-rows .row .nm { display: flex; align-items: baseline; gap: 8px; }
      .gpr-home .mock-rows .row .nm .n { font-size: 16px; font-weight: 500; }
      .gpr-home .mock-rows .row .nm .role { font-size: 12px; color: var(--gpr-mute); }
      .gpr-home .mock-rows .row .flag { width: 12px; height: 16px; display: inline-block; }
      .gpr-home .mock-rows .row .flag.y { background: var(--gpr-yellow); }
      .gpr-home .mock-rows .row .flag.r { background: var(--gpr-red); }
      .gpr-home .mock-rows .row .flag.mvp { background: var(--gpr-ink); }
      .gpr-home .mock-rows .row .score { font-size: 26px; font-weight: 500; letter-spacing: -0.02em; text-align: right; }
      .gpr-home .mock-rows .row .score.r { color: var(--gpr-red); }
      .gpr-home .mock-foot { padding: 18px 32px 24px; border-top: 1px solid var(--gpr-line); }
      .gpr-home .mock-foot .ln { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; color: var(--gpr-ink-2); }
      .gpr-home .mock-foot .ln .ago { margin-left: auto; color: var(--gpr-mute); font-size: 12px; }
      .gpr-home .mock-foot .ln .ago.r { color: var(--gpr-red); }
      .gpr-home .mock-foot .ln .nm { font-weight: 500; }
      .gpr-home .mock-foot .ln .strike { text-decoration: line-through; color: var(--gpr-mute); }

      /* ─── Big quote ─── */
      .gpr-home .quote-section {
        padding: 200px 40px;
        background: var(--gpr-red); color: #fff;
        position: relative; overflow: hidden;
      }
      .gpr-home .quote-section .label { color: rgba(255,255,255,0.6); margin-bottom: 32px; }
      .gpr-home .quote-section blockquote {
        font-size: clamp(36px, 5.4vw, 72px);
        margin: 0; font-weight: 500; letter-spacing: -0.025em; line-height: 1.08;
        max-width: 1100px;
      }
      .gpr-home .quote-section blockquote .em { color: rgba(255,255,255,0.5); }
      .gpr-home .quote-section .cite { margin-top: 56px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
      .gpr-home .quote-bg {
        position: absolute; right: -120px; bottom: -200px;
        font-size: 700px; font-weight: 500; line-height: 0.8;
        color: rgba(255,255,255,0.06);
        user-select: none; pointer-events: none;
      }

      /* ─── Capabilities ─── */
      .gpr-home .caps { padding: 160px 40px; }
      .gpr-home .caps h2 {
        font-size: clamp(40px, 6vw, 88px);
        margin: 0 0 64px;
        font-weight: 500; letter-spacing: -0.035em; line-height: 0.95;
      }
      .gpr-home .caps-grid {
        display: grid; grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 200px); gap: 16px;
      }
      .gpr-home .cap {
        background: #fff; border: 1px solid var(--gpr-line);
        padding: 28px;
        position: relative; overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .gpr-home .cap:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(10,10,10,0.06); }
      .gpr-home .cap h3 { font-size: 20px; font-weight: 500; letter-spacing: -0.015em; margin: 0 0 8px; }
      .gpr-home .cap p { font-size: 13px; color: var(--gpr-mute); margin: 0; line-height: 1.5; max-width: 280px; }
      .gpr-home .cap .ix { position: absolute; bottom: 18px; right: 22px; font-size: 11px; color: var(--gpr-mute); letter-spacing: 0.06em; }
      .gpr-home .cap.wide { grid-column: span 2; background: var(--gpr-ink); color: #fff; }
      .gpr-home .cap.wide p { color: rgba(255,255,255,0.55); }
      .gpr-home .cap.tall { grid-row: span 2; }
      .gpr-home .cap.red-cap { background: var(--gpr-red); color: #fff; }
      .gpr-home .cap.red-cap p { color: rgba(255,255,255,0.7); }

      .gpr-home .viz-wave { position: absolute; right: -10px; bottom: 0; height: 140px; width: 60%; opacity: 0.7; }

      /* ─── Final CTA ─── */
      .gpr-home .final { padding: 200px 40px 120px; }
      .gpr-home .final h2 {
        font-size: clamp(56px, 9.5vw, 168px);
        margin: 0; font-weight: 500; letter-spacing: -0.045em; line-height: 0.86;
        max-width: 1200px;
      }
      .gpr-home .final h2 .word { display: inline-block; overflow: hidden; vertical-align: top; }
      .gpr-home .final h2 .word > span { display: inline-block; }
      .gpr-home .final p { margin: 32px 0 40px; font-size: 18px; color: var(--gpr-mute); max-width: 520px; }

      .gpr-home footer {
        padding: 40px;
        display: flex; justify-content: space-between; align-items: center;
        color: var(--gpr-mute); font-size: 12px;
        flex-wrap: wrap; gap: 12px;
        border-top: 1px solid var(--gpr-line);
      }

      /* Cursor follower (only on hover-capable devices) */
      .gpr-home .cursor-dot {
        position: fixed; top: 0; left: 0;
        width: 8px; height: 8px;
        background: var(--gpr-red);
        border-radius: 50%;
        pointer-events: none; z-index: 100;
        mix-blend-mode: difference;
        transform: translate(-50%, -50%);
        transition: transform 0.18s ease;
      }
      .gpr-home .cursor-ring {
        position: fixed; top: 0; left: 0;
        width: 36px; height: 36px;
        border: 1px solid var(--gpr-ink);
        border-radius: 50%;
        pointer-events: none; z-index: 99;
        transform: translate(-50%, -50%);
        transition: transform 0.35s cubic-bezier(0.2, 0.7, 0, 1), opacity 0.2s;
      }

      @media (hover: none), (pointer: coarse) {
        .gpr-home .cursor-dot, .gpr-home .cursor-ring { display: none; }
      }

      @media (max-width: 900px) {
        .gpr-home .hero h1 { font-size: 76px; }
        .gpr-home .hero-card { display: none; }
        .gpr-home .hero-sub { grid-template-columns: 1fr; }
        .gpr-home .prob-grid,
        .gpr-home .how-grid,
        .gpr-home .cards-stage,
        .gpr-home .caps-grid,
        .gpr-home .field-grid { grid-template-columns: 1fr !important; }
        .gpr-home .caps-grid { grid-template-rows: auto; }
        .gpr-home .cap.wide, .gpr-home .cap.tall { grid-column: auto; grid-row: auto; }
        .gpr-home .cursor-dot, .gpr-home .cursor-ring { display: none; }
      }
    `}</style>
  );
}
