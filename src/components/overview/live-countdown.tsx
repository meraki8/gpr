"use client";

import { useEffect, useState } from "react";

type Props = {
  deadline: string; // ISO string from the server
};

export function LiveCountdown({ deadline }: Props) {
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Live ticker — 1Hz is enough; the rendered string only changes
    // when the cumulative seconds tick over.
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = target - now;
  if (diff <= 0) {
    const overdueMs = -diff;
    const days = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
    return (
      <span style={{ color: "var(--red)", fontWeight: 600 }}>
        OVERDUE
        <span
          className="num mute-ink"
          style={{ marginLeft: 8, fontSize: 13, fontWeight: 400 }}
        >
          {days} day{days === 1 ? "" : "s"} ago
        </span>
      </span>
    );
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return (
    <span className="num">
      {days > 0 && (
        <>
          <strong>{days}</strong> day{days === 1 ? "" : "s"}{" "}
        </>
      )}
      <strong>{hours}</strong> hour{hours === 1 ? "" : "s"}{" "}
      {days === 0 && (
        <>
          <strong>{minutes}</strong> min{" "}
        </>
      )}
      <span className="mute-ink" style={{ fontSize: 13 }}>
        left
      </span>
    </span>
  );
}
