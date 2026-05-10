"use client";

import { useState } from "react";

export function AvatarImg({
  src,
  alt,
  size,
  initial,
}: {
  src: string;
  alt: string;
  size: number;
  initial: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: "var(--ink)",
          color: "var(--bg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(size * 0.4),
          fontWeight: 600,
        }}
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ borderRadius: 999, objectFit: "cover" }}
    />
  );
}
