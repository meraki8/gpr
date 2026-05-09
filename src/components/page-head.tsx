import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between gap-8"
      style={{ padding: "80px 0 56px" }}
    >
      <div style={{ maxWidth: 720 }}>
        {eyebrow && <div className="label" style={{ marginBottom: 18 }}>{eyebrow}</div>}
        <h1 className="display h-l" style={{ margin: 0 }}>
          {title}
        </h1>
        {sub && (
          <p
            className="body-lg"
            style={{ marginTop: 18, marginBottom: 0, maxWidth: 540 }}
          >
            {sub}
          </p>
        )}
      </div>
      {right && (
        <div style={{ flexShrink: 0, display: "flex", gap: 10 }}>{right}</div>
      )}
    </div>
  );
}
