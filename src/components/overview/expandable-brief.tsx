"use client";

import { useState } from "react";

type Props = {
  brief: string;
};

export function ExpandableBrief({ brief }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = brief.length > 180;

  return (
    <div>
      <p
        className="body"
        style={{
          margin: 0,
          color: "var(--ink-2)",
          lineHeight: 1.55,
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
        }}
      >
        {brief || "No brief written yet."}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            marginTop: 6,
            color: "var(--mute)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
